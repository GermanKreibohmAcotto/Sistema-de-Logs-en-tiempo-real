# Referencia de la API

Base URL en dev: `http://localhost:4000`. Todos los cuerpos son JSON. Ver los
esquemas exactos en `packages/shared/src/*.ts` (fuente única de verdad,
compartida entre API y frontend).

## Autenticación

| Grupo de rutas                 | Mecanismo                                                                                                                                       |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Ingesta (`POST /v1/logs*`)     | Header `x-api-key`. Ver [ENVIAR-LOGS.md](./ENVIAR-LOGS.md).                                                                                     |
| Lecturas del dashboard         | Header `x-dashboard-token`, si `DASHBOARD_TOKEN` está configurado (vacío = abierto).                                                            |
| Export (`GET /v1/logs/export`) | Query param `ticket`, obtenido de `POST /v1/logs/export/ticket` (esa sí lleva el header). Un GET de navegador no puede llevar headers.          |
| WebSocket (`/ws`)              | Primer frame `{"type":"auth","token":"..."}`, si `DASHBOARD_TOKEN` está configurado. Un `new WebSocket()` de navegador no puede llevar headers. |

## `GET /health`

Sin auth. `{ status: 'ok', writeBuffer: { pending, droppedTotal } }`.

## `POST /v1/logs`

Auth: `x-api-key`. Body: un evento (`LogEventInput`):

```json
{
  "level": "ERROR",
  "service": "checkout",
  "message": "fallo el pago",
  "timestamp": "2026-08-13T12:00:00Z",
  "metadata": { "orderId": 123 },
  "traceId": "abc-123"
}
```

`timestamp` es opcional (default: ahora) y se rechaza si está a más de ±24h
del reloj del servidor. `level` es uno de `DEBUG|INFO|WARN|ERROR|FATAL`.

Respuestas: `202 { accepted: 1 }` · `400` payload inválido · `401` sin/mal API
key · `403` key revocada · `429` rate limit (`Retry-After` en el header) ·
`503 { error: 'buffer_full' }` si el buffer de escritura está lleno.

## `POST /v1/logs/bulk`

Igual que arriba, pero body es un array (1 a `BULK_MAX_ITEMS`, default 1000)
de eventos. Acepta parcialmente: `202 { accepted: N, rejected: [{ index, error }] }`.
Un rate limit sobre este endpoint consume **N tokens**, uno por evento, no 1.

## `GET /v1/logs`

Auth: dashboard. Query params (todos opcionales): `levels` (CSV, p.ej.
`WARN,ERROR`), `services` (CSV), `q` (búsqueda de texto libre, fragmento),
`from`/`to` (ISO 8601), `cursor`, `limit` (1-500, default 100).

`{ items: LogEvent[], nextCursor: string | null }` — paginación por keyset
sobre `(ts, id)`; pasar `nextCursor` como `cursor` para la página siguiente.

## `GET /v1/stats/timeseries`

Auth: dashboard. Mismos filtros que arriba más `bucketSeconds` (10-3600,
default 60). `{ buckets: [{ bucketStart, counts: { DEBUG, INFO, WARN, ERROR, FATAL } }] }`.

## `POST /v1/logs/export/ticket`

Auth: dashboard. Sin body. `{ ticket: string }` — válido 60s, un solo uso.

## `GET /v1/logs/export`

Auth: `?ticket=...` (ver arriba). Mismos filtros que `/v1/logs` más `format`
(`csv` \| `json` \| `ndjson`, default `csv`). Streaming real, sin límite de
memoria hasta `EXPORT_MAX_ROWS`.

## Alertas

Auth: dashboard en todas.

- `GET /v1/alerts/rules` → `{ rules: AlertRule[] }`
- `POST /v1/alerts/rules` — body `AlertRuleInput`: `name`, `levels` (array),
  `service?`, `threshold`, `windowSeconds`, `cooldownSeconds` (default 60),
  `enabled` (default true) → `201 { rule }`
- `PATCH /v1/alerts/rules/:id` — body parcial de lo anterior → `{ rule }`
- `DELETE /v1/alerts/rules/:id` → `204`
- `GET /v1/alerts?limit=50` → `{ alerts: Alert[] }` (historial de disparos)

Una regla dispara cuando se acumulan `threshold` eventos de esos `levels` (y
opcionalmente ese `service`) dentro de `windowSeconds`, con un `cooldownSeconds`
antes de poder volver a dispararse.

## WebSocket `/ws`

Mensajes cliente → servidor (`packages/shared/src/ws-protocol.ts`):

| Tipo        | Payload       | Qué hace                                                                                                                        |
| ----------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `auth`      | `{ token }`   | Requerido primero si `DASHBOARD_TOKEN` está configurado; si no llega en 5s o es inválido, el servidor cierra con código `4401`. |
| `subscribe` | `{ filters }` | Mismo shape de filtros que `GET /v1/logs` (sin `cursor`/`limit`). Reemplaza la suscripción anterior.                            |
| `pause`     | —             | Deja de recibir frames `logs`, cuenta lo que se pierde.                                                                         |
| `resume`    | —             | Reanuda; responde `{ type: 'paused', missed }` con lo perdido durante la pausa.                                                 |
| `ping`      | —             | El servidor responde `pong`.                                                                                                    |

Mensajes servidor → cliente: `logs` (batch de eventos que matchean el
filtro), `dropped` (se descartó un lote por backpressure), `alert` (una regla
disparó), `stats` (buckets de los últimos 60 min, cada 5s), `paused`,
`subscribed`, `pong`.
