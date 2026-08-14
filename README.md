# Sistema de Monitoreo y Gestión de Logs en Tiempo Real

Plataforma centralizada para ingestar, indexar, almacenar y visualizar en vivo los logs de múltiples microservicios: ingesta HTTP con API Key + rate limiting, streaming en vivo por WebSocket, búsqueda histórica, gráficos, alertas por umbral y exportación CSV/JSON/NDJSON.

## Arquitectura

```
microservicios ──HTTP──► [ Ingest API ]──► Redis Pub/Sub ──► [ WS Gateway ] ──WS──► Navegador
                          (Fastify)   │                          │
                                      │                    (filtra + batchea
                                      │                     por cliente)
                                      ├──► write-buffer ──► PostgreSQL (particionado por día)
                                      └──► [ Alert Engine ] (ventana deslizante en Redis)
```

Un solo proceso Node aloja la API de ingesta, el gateway WebSocket y el motor de alertas — comparten la conexión a Redis y evitan un salto de red extra a esta escala. Ver [`.claude` plan](../.claude) o la sección **Decisiones y trade-offs** más abajo para el razonamiento completo.

### Monorepo (npm workspaces)

```
packages/shared/   @logs/shared — esquemas Zod + tipos + protocolo WS, fuente única de verdad
                    del contrato de log entre API y frontend.
apps/api/           Fastify: ingesta, query histórica, stats, export, alertas, gateway WS.
apps/web/            React 19 + Vite + Tailwind v4: dashboard en vivo.
apps/loadgen/         Generador de carga (undici) para validar throughput y ráfagas.
```

## Stack

Fastify 5 · `ws` vía `@fastify/websocket` (no SignalR — es de .NET) · PostgreSQL 17 (particionado diario) · Redis 8 (Pub/Sub, contadores, ventanas deslizantes, rate limiting) · React 19 + Vite + Tailwind v4 · `@tanstack/react-virtual` · Recharts · Zod · Vitest · Docker Compose.

## Cómo correrlo

### Con Docker (recomendado)

Requiere Docker Desktop con virtualización de hardware habilitada (ver **Estado conocido** más abajo).

```bash
docker compose up -d --build
```

Esto levanta Postgres, Redis, la API (corre las migraciones automáticamente al iniciar — son idempotentes) y el frontend servido por nginx en `http://localhost:8080`. La API queda expuesta en `http://localhost:4000`.

Crear una API key para poder ingestar logs:

```bash
docker compose exec api node apps/api/dist/cli/create-key.js "mi-servicio" 6000
```

### Sin Docker (desarrollo local)

```bash
npm install
cp .env.example .env
# levantar postgres/redis por tu cuenta, o via: docker compose up -d postgres redis
npm run db:migrate
npm run keys:create -- "mi-servicio" 6000
npm run dev:api     # http://localhost:4000
npm run dev:web     # http://localhost:5173
```

### Prueba de carga

```bash
# criterio de aceptacion: 500 logs/s sostenidos
npx tsx apps/loadgen/src/index.ts --rate 500 --duration 60 --services 8 --error-rate 0.05 --api-key <la-key-creada>

# rafaga: valida que la UI no se congele
npx tsx apps/loadgen/src/index.ts --rate 2000 --duration 30 --burst 10000 --api-key <la-key-creada>
```

> Usá `npx tsx apps/loadgen/src/index.ts --flag valor`, no `npm run load -- --flag valor`: en npm 11 sobre Windows, `npm run <script> -- --flag valor` descarta los nombres de flag y deja pasar solo los valores posicionalmente (se confirmó reproducible tanto en un solo nivel de `npm run` como en el wrapper `load` anidado) — el loadgen termina corriendo con sus defaults en vez de tus flags, sin avisar. `npm run load` sin argumentos extra sí funciona bien (corre con los defaults).

El reporte final incluye throughput real, percentiles de latencia (p50/p95/p99) y códigos de estado. Con Docker: `docker compose --profile load run --rm loadgen --rate 500 --duration 60` (los args del `command:` del compose no pasan por `npm run`, así que no les afecta esta limitación).

### Tests

```bash
npm test
```

- **Unitarios** (no requieren infraestructura): esquemas Zod de `@logs/shared`, el matcher de filtros del gateway WS, el escapado CSV RFC 4180, el ring buffer + coalescing por `requestAnimationFrame` del `LogStore` del frontend (entorno jsdom), y el token bucket del rate limiter (Redis mockeado con una reimplementación fiel del script Lua).
- **Integración** (`apps/api/test/integration/`): ingesta → fila persistida y consultable; ingesta → el cliente WS recibe solo los eventos que matchean su filtro (incluye pausa/reanudación); exceso de rate limit → 429, key inválida → 401, key revocada → 403; export → CSV/NDJSON/JSON válidos con escapado correcto; N errores en la ventana → alerta disparada y respetando el cooldown. Corren contra una base `logs_test` real (se crea y migra sola) y Redis — se auto-detectan y se **saltan limpiamente** si Postgres/Redis no están alcanzables, en vez de fallar el run completo.

## Decisiones y trade-offs

- **WebSocket nativo, no SignalR.** El enunciado pedía SignalR, pero es una tecnología de .NET — en Node solo existe un cliente. Se usa `ws` vía `@fastify/websocket`, con protocolo tipado en `packages/shared/src/ws-protocol.ts`.

- **Por qué la UI no se congela bajo ráfaga** (el criterio de aceptación más exigente):
  1. El gateway **filtra en el servidor** antes de construir cada frame — un cliente mirando solo `ERROR` nunca recibe los `INFO`.
  2. **Batching por cliente con un único timer global** (`WS_BATCH_MS`, 100ms) en vez de un timer por socket: 500 eventos/s se convierten en ~10 frames/s.
  3. **Backpressure real**: si `socket.bufferedAmount` supera `WS_MAX_BUFFERED_BYTES` se descarta el lote de ese tick (se cuenta y se avisa vía un frame `dropped`); la cola pendiente por cliente está acotada (`WS_CLIENT_QUEUE_MAX`, ring buffer). Un cliente lento degrada su propia vista, nunca la memoria del servidor.
  4. En el frontend, **los logs viven fuera de React** (`LogStore`, ring buffer de 10 000 con `useSyncExternalStore`) y las notificaciones se coalescen con `requestAnimationFrame` — como mucho un re-render por frame de pantalla, sin importar cuántos WS frames lleguen en el medio.
  5. **Consola virtualizada** (`@tanstack/react-virtual`): ~40 filas en el DOM en vez de 10 000. Auto-scroll con anclaje: si el usuario scrollea hacia arriba se desancla y aparece "Ir al final (N nuevos)" en vez de pelear por el control del viewport.

- **Ingesta: `202` tras validar y publicar, sin esperar el flush a Postgres.** El write-buffer batchea inserts (`INSERT ... SELECT * FROM unnest(...)`, flush cada 200ms o 500 filas) de forma asíncrona respecto de la respuesta HTTP. Mantiene la latencia de ingesta baja y desacopla el throughput de la latencia del disco, a costa de una ventana de ~200ms de durabilidad *at-most-once*. Mitigado con: flush forzado en `SIGTERM`/`SIGINT`, buffer acotado (`MAX_BUFFER_ROWS`, responde `503` si se llena en vez de crecer sin límite), y `INGEST_SYNC=true` para quien prefiera esperar el commit a costa de latencia.

- **Rate limiting: token bucket en un script Lua de Redis**, atómico, por API key. Una request de `/v1/logs/bulk` con N logs consume **N tokens, no 1** — sin esto el límite se evade trivialmente mandando lotes grandes. Ver `apps/api/src/plugins/rate-limit.ts`.

- **Alertas: ventana deslizante con un sorted set de Redis** (no `INCR` con ventana fija) para evitar el problema clásico de frontera — 20 errores repartidos justo alrededor de un límite de minuto no deberían evadir un umbral de "10 en 1 minuto". `ZREMRANGEBYSCORE` + `ZADD` + `ZCARD` en un único script Lua atómico.

- **Postgres particionado por día**, con índice BRIN sobre `ts`, btree por `(service, ts)` y `(level, ts)`, y GIN trigram (`pg_trgm`) sobre `message` — se eligió trigram sobre `tsvector` porque en logs se busca por fragmentos (`"timeout"` dentro de `"connection timeout after 30s"`, IDs, rutas), no por lexemas de lenguaje natural. La retención (`RETENTION_DAYS`) es un `DROP TABLE` de la partición vieja, instantáneo, en vez de un `DELETE` masivo.

- **Export en streaming real** (`pg-query-stream` → `Transform` → response): nunca se materializa el resultado completo en memoria, sea 500 filas o el máximo (`EXPORT_MAX_ROWS`).

- **Alcance del API Key**: protege solo la ingesta, como pide el enunciado. Las lecturas del dashboard (`GET /v1/logs`, stats, export, alertas) quedan detrás de un `DASHBOARD_TOKEN` opcional (desactivado en dev). Un despliegue real necesitaría autenticación de usuarios — deliberadamente fuera de alcance.

## Fuera de alcance (anotado, no implementado)

Autenticación de usuarios del dashboard, multi-tenancy, TLS, escalado horizontal del gateway WS (requeriría sticky sessions o mover el fan-out a Redis Streams con grupos de consumidores), y notificaciones externas de alertas (email/Slack) — el motor de alertas deja el punto de extensión listo (`broadcastAlert` en `apps/api/src/realtime/gateway.ts`).

## Estado de verificación

Verificado de punta a punta contra infraestructura real (Postgres, Redis y Docker Compose corriendo de verdad, no mockeados):

- **Migraciones**: corridas contra Postgres real; las 4 particiones diarias + la particion `DEFAULT` se crean correctamente al arrancar la API.
- **`docker compose up -d --build`**: los 4 servicios (postgres, redis, api, web) levantan y quedan `healthy`.
- **Carga sostenida**: 500 logs/s durante 30s → 100% aceptados, 0 rechazados, 0 requests fallidos, p99 ~30ms.
- **Ráfaga**: 50 000 logs (10 000 de golpe + 2000/s sostenidos) → 100% aceptados, 0 perdidos, buffer de escritura totalmente drenado después (`pending: 0`); la latencia por lote sube durante la ráfaga (p99 ~700ms) mientras el write-buffer la absorbe, sin que el servidor caiga ni rechace nada. Conteo de filas verificado exacto en Postgres.
- **Suite completa**: 61/61 tests en verde, incluyendo la suite de integración corriendo de verdad contra Postgres/Redis reales (no el modo skip).
- **Dashboard en vivo**: probado en el navegador contra el stack real — el pipeline completo ingesta → Redis pub/sub → gateway WS → navegador se verificó a nivel de protocolo (conexión WS cruda recibiendo frames `logs` con el volumen exacto enviado) y el motor de alertas disparó alertas reales a partir del tráfico de la prueba de carga.

### Bugs reales encontrados y corregidos durante esta verificación

Ninguno de estos era visible sin infraestructura real corriendo — quedaron documentados porque cada uno habría roto el sistema en producción:

1. **DDL con bind parameters**: `CREATE TABLE ... PARTITION OF logs FOR VALUES FROM ($1) TO ($2)` — Postgres no soporta parámetros bindeados en sentencias DDL (son sentencias de utilidad, no planes DML). El error solo aparece contra un Postgres real, nunca en un mock. Arreglado interpolando las fechas (generadas internamente, nunca input de usuario) directamente en el SQL. Ver `apps/api/src/maintenance/partitions.ts`.
2. **Arrays de enum de Postgres**: `node-postgres` no auto-parsea un array de un tipo enum custom (`log_level[]`) — lo devuelve como el string literal crudo (`"{ERROR}"`) en vez de un array JS, a menos que se castee explícitamente. Rompía el dashboard (`rule.levels.join is not a function`) apenas existía una regla de alerta. Arreglado casteando `levels::text[]` en las queries. Ver `apps/api/src/alerts/rules-cache.ts` y `apps/api/src/routes/alerts.ts`.
3. **CLI que no terminaba nunca**: `create-key.ts` importaba (transitivamente) los tres clientes de `ioredis`, que abren conexiones activas al importarse — el script hacía su trabajo y nunca salía porque nada cerraba esas conexiones. Arreglado desconectándolas explícitamente antes de salir.
4. **Carrera de concurrencia en el setup de tests**: Vitest corre los archivos de test en paralelo, cada uno con su propio registro de módulos aislado — múltiples archivos de integración intentaban `CREATE DATABASE logs_test` y correr las migraciones al mismo tiempo, causando errores de clave duplicada y tablas faltantes. Arreglado serializando esa sección con un advisory lock de Postgres.
5. **`buildApp()` no arrancaba el suscriptor de Redis**: `startLogSubscriber()` solo se llamaba desde `server.ts`, no desde `buildApp()` — cualquier consumidor de `buildApp()` que no fuera el entrypoint de producción (como los tests) obtenía un gateway WS que aceptaba conexiones pero nunca recibía logs. Arreglado moviendo la llamada dentro de `buildApp()`.
6. **`fs.cpSync({recursive:true})` crashea Node 22.17.1 en Windows** con `STATUS_STACK_BUFFER_OVERRUN` (bug nativo, reproducible sin código del proyecto de por medio). El build de `apps/api` copiaba las migraciones con esa función. Arreglado con un loop `readdirSync` + `copyFileSync` (el directorio de migraciones es plano, no necesita recursión).
7. **`npm run <script> -- --flag valor` descarta los flags** en npm 11 sobre Windows (confirmado en un nivel y en dos niveles de `npm run` anidado) — ver la nota en "Prueba de carga" más arriba.

### Nota sobre Docker Desktop en este entorno

Docker Desktop necesitó dos arreglos de infraestructura antes de poder levantar: la virtualización de hardware estaba deshabilitada en el firmware (se resolvió habilitándola desde BIOS/UEFI y reiniciando), y luego quedaban sockets Unix corruptos de un intento de arranque fallido anterior (`%LOCALAPPDATA%\Docker\run\dockerInference` y `%LOCALAPPDATA%\docker-secrets-engine\engine.sock`) que ninguna herramienta de Windows podía borrar (`Remove-Item`, `del`, `icacls` fallaban todas con el mismo error de "sistema no tiene acceso al archivo" sobre un reparse point aparentemente corrupto) — se resolvió borrándolos vía WSL (`wsl -e rm -fv <ruta /mnt/c/...>`), que sí pudo tocarlos.
