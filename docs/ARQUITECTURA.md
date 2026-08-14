# Arquitectura y decisiones de diseño

```
microservicios ──HTTP──► [ Ingest API ]──► Redis Pub/Sub ──► [ WS Gateway ] ──WS──► Navegador
                          (Fastify)   │                          │
                                      │                    (filtra + batchea
                                      │                     por cliente)
                                      ├──► write-buffer ──► PostgreSQL (particionado por día)
                                      └──► [ Alert Engine ] (ventana deslizante en Redis)
```

Un solo proceso Node aloja la API de ingesta, el gateway WebSocket y el motor
de alertas — comparten la conexión a Redis y evitan un salto de red extra a
esta escala.

### Monorepo (npm workspaces)

```
packages/shared/   @logs/shared — esquemas Zod + tipos + protocolo WS, fuente
                    única de verdad del contrato de log entre API y frontend.
packages/client/    @logs/client — SDK para mandar logs desde tu app (batching,
                    reintentos, flush en shutdown).
apps/api/            Fastify: ingesta, query histórica, stats, export, alertas,
                    gateway WS.
apps/web/             React 19 + Vite + Tailwind v4: dashboard en vivo.
apps/loadgen/          Generador de carga (undici) para validar throughput y
                    ráfagas.
```

## WebSocket nativo, no SignalR

`ws` vía `@fastify/websocket`, con protocolo tipado en
`packages/shared/src/ws-protocol.ts`. SignalR es tecnología .NET — en Node
solo existe un cliente de terceros, no vale la pena la dependencia.

## Por qué la UI no se congela bajo ráfaga

1. El gateway **filtra en el servidor** antes de construir cada frame — un
   cliente mirando solo `ERROR` nunca recibe los `INFO`.
2. **Batching por cliente con un único timer global** (`WS_BATCH_MS`, 100ms)
   en vez de un timer por socket: 500 eventos/s se convierten en ~10 frames/s.
3. **Backpressure real**: si `socket.bufferedAmount` supera
   `WS_MAX_BUFFERED_BYTES` se descarta el lote de ese tick (se cuenta y se
   avisa vía un frame `dropped`); la cola pendiente por cliente está acotada
   (`WS_CLIENT_QUEUE_MAX`, ring buffer). Un cliente lento degrada su propia
   vista, nunca la memoria del servidor.
4. En el frontend, **los logs viven fuera de React** (`LogStore`, ring buffer
   de 10.000 con `useSyncExternalStore`) y las notificaciones se coalescen con
   `requestAnimationFrame` — como mucho un re-render por frame de pantalla,
   sin importar cuántos frames WS lleguen en el medio.
5. **Consola virtualizada** (`@tanstack/react-virtual`): ~40 filas en el DOM
   en vez de 10.000. Auto-scroll con anclaje: si el usuario scrollea hacia
   arriba se desancla y aparece "Ir al final (N nuevos)" en vez de pelear por
   el control del viewport.

## Ingesta: `202` tras validar y publicar, sin esperar el flush a Postgres

El write-buffer (`apps/api/src/ingest/write-buffer.ts`) batchea inserts
(`INSERT ... SELECT * FROM unnest(...)`, flush cada `WRITE_FLUSH_MS` o
`WRITE_FLUSH_ROWS` filas) de forma asíncrona respecto de la respuesta HTTP.
Mantiene la latencia de ingesta baja y desacopla el throughput de la latencia
del disco, a costa de una ventana de durabilidad *at-most-once* de ese orden.
Mitigado con: flush forzado en `SIGTERM`/`SIGINT`, buffer acotado
(`MAX_BUFFER_ROWS`, responde `503` si se llena en vez de crecer sin límite), y
`INGEST_SYNC=true` para quien prefiera esperar el commit a costa de latencia.

## Rate limiting: token bucket en un script Lua de Redis

Atómico, por API key (`apps/api/src/plugins/rate-limit.ts`). Una request de
`/v1/logs/bulk` con N logs consume **N tokens, no 1** — sin esto el límite se
evade trivialmente mandando lotes grandes.

## Alertas: ventana deslizante con un sorted set de Redis

No `INCR` con ventana fija — evita el problema clásico de frontera (20 errores
repartidos justo alrededor de un límite de minuto no deberían evadir un umbral
de "10 en 1 minuto"). `ZREMRANGEBYSCORE` + `ZADD` + `ZCARD` en un único script
Lua atómico (`apps/api/src/alerts/engine.ts`).

## Postgres particionado por día

Índice BRIN sobre `ts`, btree por `(service, ts)` y `(level, ts)`, y GIN
trigram (`pg_trgm`) sobre `message` — trigram en vez de `tsvector` porque en
logs se busca por fragmentos (`"timeout"` dentro de
`"connection timeout after 30s"`, IDs, rutas), no por lexemas de lenguaje
natural. La retención (`RETENTION_DAYS`) es un `DROP TABLE` de la partición
vieja, instantáneo, en vez de un `DELETE` masivo.

## Export en streaming real

`pg-query-stream` → `Transform` → response (`apps/api/src/routes/export.ts`):
nunca se materializa el resultado completo en memoria, sea 500 filas o el
máximo (`EXPORT_MAX_ROWS`).

## Autenticación

- **Ingesta**: API key por servicio productor (`x-api-key`), con rate limiting
  propio. Ver [ENVIAR-LOGS.md](./ENVIAR-LOGS.md).
- **Lecturas del dashboard** (`GET /v1/logs`, stats, alertas, export, WS):
  gateadas por `DASHBOARD_TOKEN` — vacío en dev, obligatorio en un despliegue
  real. El export, al dispararse como navegación del browser, no puede llevar
  el header: usa un ticket de un solo uso de 60s en su lugar
  (`apps/api/src/export/tickets.ts`). El handshake WS, por la misma
  limitación, recibe el token como primer frame (`{type: 'auth', token}`) en
  vez de un header o query param.
- **Fuera de alcance, deliberadamente**: autenticación de usuarios del
  dashboard (login/roles), multi-tenancy, TLS terminado por la app (usar un
  reverse proxy), y escalado horizontal del gateway WS (requeriría sticky
  sessions o mover el fan-out a Redis Streams con grupos de consumidores). El
  motor de alertas deja el punto de extensión para notificaciones externas
  listo: `broadcastAlert` en `apps/api/src/realtime/gateway.ts`.
