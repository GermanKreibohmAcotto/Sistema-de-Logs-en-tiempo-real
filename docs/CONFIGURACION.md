# Configuración

Todas las variables se leen una sola vez, en `apps/api/src/config.ts`, y se
validan con Zod al arrancar — si algo está mal el proceso falla de inmediato
en vez de fallar más tarde a mitad de una request. Punto de partida:
`.env.example` (copiarlo a `.env`).

## API

| Variable                   | Default                 | Qué hace                                                                                                                                                                                         |
| -------------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `NODE_ENV`                 | `development`           | `development` \| `test` \| `production`.                                                                                                                                                         |
| `PORT`                     | `4000`                  | Puerto HTTP/WS de la API.                                                                                                                                                                        |
| `HOST`                     | `0.0.0.0`               | Interfaz de escucha.                                                                                                                                                                             |
| `DATABASE_URL`             | — (requerido)           | Conexión a Postgres.                                                                                                                                                                             |
| `REDIS_URL`                | — (requerido)           | Conexión a Redis.                                                                                                                                                                                |
| `DASHBOARD_TOKEN`          | vacío                   | Token para las lecturas del dashboard (logs, stats, alertas, export, WS). Vacío = modo local abierto, sin autenticación. **Generar uno para cualquier despliegue real**: `openssl rand -hex 32`. |
| `CORS_ORIGIN`              | `http://localhost:5173` | Origen permitido en dev. En producción nginx sirve todo desde un mismo origen, así que esto casi no importa ahí.                                                                                 |
| `INGEST_SYNC`              | `false`                 | `true` = esperar el flush a Postgres antes de responder al productor (más durable, más lento).                                                                                                   |
| `MAX_BUFFER_ROWS`          | `50000`                 | Filas en el buffer de escritura antes de responder `503`.                                                                                                                                        |
| `WRITE_FLUSH_MS`           | `200`                   | Cada cuánto se vacía el buffer de escritura, como máximo.                                                                                                                                        |
| `WRITE_FLUSH_ROWS`         | `500`                   | O cuando junta esta cantidad de filas, lo que pase primero.                                                                                                                                      |
| `PUBLISH_COALESCE_MS`      | `50`                    | Ventana de coalescing antes de publicar a Redis Pub/Sub.                                                                                                                                         |
| `PUBLISH_COALESCE_MAX`     | `200`                   | Tope de eventos por mensaje publicado.                                                                                                                                                           |
| `BULK_MAX_ITEMS`           | `1000`                  | Máximo de eventos por request a `/v1/logs/bulk`.                                                                                                                                                 |
| `WS_BATCH_MS`              | `100`                   | Intervalo del timer global de batching hacia clientes WS.                                                                                                                                        |
| `WS_MAX_BUFFERED_BYTES`    | `1048576`               | Umbral de `socket.bufferedAmount` para empezar a descartar el lote de ese tick (backpressure).                                                                                                   |
| `WS_CLIENT_QUEUE_MAX`      | `2000`                  | Tope de la cola pendiente por cliente WS (ring buffer, descarta lo más viejo).                                                                                                                   |
| `WS_HEARTBEAT_MS`          | `30000`                 | Intervalo de ping/pong para cerrar sockets muertos.                                                                                                                                              |
| `RETENTION_DAYS`           | `30`                    | Antigüedad a partir de la cual se dropean particiones diarias de `logs`.                                                                                                                         |
| `PARTITION_LOOKAHEAD_DAYS` | `7`                     | Cuántos días de particiones futuras se crean por adelantado.                                                                                                                                     |
| `EXPORT_MAX_ROWS`          | `1000000`               | Tope de filas por export.                                                                                                                                                                        |

## Web (Vite, en build time)

| Variable            | Default                  | Qué hace                                                                                                          |
| ------------------- | ------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| `VITE_API_BASE_URL` | `http://localhost:4000`  | URL base de la API. En producción se deja vacía (`""`) para que nginx sirva API y frontend desde el mismo origen. |
| `VITE_WS_URL`       | `ws://localhost:4000/ws` | URL del WebSocket. En producción, `/ws` (relativo), resuelto contra el origen de la página en runtime.            |

El `DASHBOARD_TOKEN`, si el backend lo tiene configurado, no se setea acá: el
navegador lo pide una vez por interfaz y lo guarda en `localStorage`.

## Loadgen

| Variable             | Default                 | Qué hace                   |
| -------------------- | ----------------------- | -------------------------- |
| `LOADGEN_TARGET_URL` | `http://localhost:4000` | API contra la que dispara. |
| `LOADGEN_API_KEY`    | vacío                   | API key de ingesta a usar. |
