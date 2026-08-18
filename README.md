# Sistema de Monitoreo y Gestión de Logs en Tiempo Real

![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D20-brightgreen)
[![CI](https://github.com/GermanKreibohmAcotto/Sistema-de-Monitoreo-y-Gesti-n-de-Logs-en-Tiempo-Real/actions/workflows/ci.yml/badge.svg)](https://github.com/GermanKreibohmAcotto/Sistema-de-Monitoreo-y-Gesti-n-de-Logs-en-Tiempo-Real/actions/workflows/ci.yml)

Plataforma open source, autohospedable, para centralizar e ingestar los logs
de tus servicios y verlos en vivo en un dashboard web: streaming en tiempo
real por WebSocket, búsqueda histórica, gráficos, alertas por umbral y
exportación CSV/JSON/NDJSON.

<!-- TODO: captura o GIF del dashboard acá -->

## Para quién es

Para levantar tu propia plataforma de logs sin depender de un SaaS: un
`docker compose up` en tu propio servidor, tus datos se quedan ahí.

## Inicio rápido

Requiere Docker.

```bash
git clone https://github.com/GermanKreibohmAcotto/Sistema-de-Monitoreo-y-Gesti-n-de-Logs-en-Tiempo-Real.git
cd Sistema-de-Monitoreo-y-Gesti-n-de-Logs-en-Tiempo-Real
docker compose up -d --build
```

Esto levanta Postgres, Redis, la API (corre las migraciones solas al iniciar)
y el dashboard servido por nginx. Abrí **http://localhost:8080** — la primera
vez te va a pedir un token; si no configuraste `DASHBOARD_TOKEN`, cualquier
valor sirve (ver [docs/CONFIGURACION.md](./docs/CONFIGURACION.md)).

Creá una API key para poder mandar logs:

```bash
docker compose exec api node apps/api/dist/cli/create-key.js "mi-servicio" 6000
```

## Mandá tus primeros logs

```bash
curl -X POST http://localhost:4000/v1/logs \
  -H "x-api-key: <la-key-que-creaste>" \
  -H "content-type: application/json" \
  -d '{"level":"INFO","service":"mi-servicio","message":"hola desde curl"}'
```

Deberías verlo aparecer en el dashboard al instante. Para integrarlo en tu
app (Node, curl, Python, o cualquier lenguaje por HTTP) ver
[docs/ENVIAR-LOGS.md](./docs/ENVIAR-LOGS.md) — incluye `@logs/client`, un SDK
chico sin dependencias con batching y reintentos.

## Funcionalidades

- Ingesta HTTP con API key propia por servicio + rate limiting.
- Streaming en vivo por WebSocket con filtrado y batching en el servidor.
- Búsqueda histórica con paginación y filtro por nivel/servicio/texto/rango.
- Gráfico de eventos por minuto, por severidad.
- Alertas por umbral con ventana deslizante y cooldown.
- Exportación en streaming a CSV/JSON/NDJSON, sin límite de memoria.
- Dashboard protegido por token, apagado por default en modo local.

## Arquitectura

```
microservicios ──HTTP──► [ Ingest API ]──► Redis Pub/Sub ──► [ WS Gateway ] ──WS──► Navegador
                          (Fastify)   │                          │
                                      ├──► write-buffer ──► PostgreSQL (particionado por día)
                                      └──► [ Alert Engine ] (ventana deslizante en Redis)
```

Fastify 5 · `ws` vía `@fastify/websocket` · PostgreSQL 17 (particionado
diario) · Redis 8 · React 19 + Vite + Tailwind v4 · Zod · Vitest · Docker
Compose. El razonamiento completo de cada decisión está en
[docs/ARQUITECTURA.md](./docs/ARQUITECTURA.md).

## Desarrollo local (sin Docker)

```bash
npm install
cp .env.example .env
docker compose up -d postgres redis   # o tu propia instancia
npm run db:migrate
npm run keys:create -- "mi-servicio" 6000
npm run dev:api     # http://localhost:4000
npm run dev:web     # http://localhost:5173
```

### Tests

```bash
npm test
```

Los unitarios no requieren infraestructura. Los de integración
(`apps/api/test/integration/`) corren contra una `logs_test` real y Redis, y
se **saltan limpiamente** si no están alcanzables en vez de romper el run
completo — así pasa tanto en tu máquina sin Docker corriendo como en CI.

### Prueba de carga

```bash
npx tsx apps/loadgen/src/index.ts --rate 500 --duration 60 --api-key <la-key>
```

Usá `npx tsx` directo, no `npm run load -- --flag`: en npm 11 sobre Windows,
`npm run <script> -- --flag valor` descarta los nombres de flag (bug de npm,
no de este repo) y el loadgen termina corriendo con sus defaults sin avisar.

## Configuración

Todas las variables están documentadas en
[docs/CONFIGURACION.md](./docs/CONFIGURACION.md); punto de partida:
`.env.example`. La única que importa antes de exponer esto fuera de tu red
local es `DASHBOARD_TOKEN` — sin ella, cualquiera que llegue a la API lee
todos tus logs.

## Más documentación

- [docs/ARQUITECTURA.md](./docs/ARQUITECTURA.md) — decisiones de diseño y sus trade-offs.
- [docs/API.md](./docs/API.md) — referencia de endpoints HTTP y protocolo WebSocket.
- [docs/ENVIAR-LOGS.md](./docs/ENVIAR-LOGS.md) — integrar tu app como productor.
- [docs/DESPLIEGUE.md](./docs/DESPLIEGUE.md) — llevarlo a un servidor real.

## Contribuir

Los aportes son bienvenidos. Mirá [CONTRIBUTING.md](./CONTRIBUTING.md) para
levantar el entorno y las convenciones del proyecto, o los issues con la
etiqueta [`good first issue`](https://github.com/GermanKreibohmAcotto/Sistema-de-Monitoreo-y-Gesti-n-de-Logs-en-Tiempo-Real/labels/good%20first%20issue)
si buscás por dónde arrancar.

## Licencia

[MIT](./LICENSE)
