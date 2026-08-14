# Enviar logs desde tu app

Primero necesitás una API key de ingesta:

```bash
# con Docker
docker compose exec api node apps/api/dist/cli/create-key.js "mi-servicio" 6000

# sin Docker
npm run keys:create -- "mi-servicio" 6000
```

El segundo argumento es el rate limit en requests/minuto. La key se muestra
una sola vez — guardala.

## Node / TypeScript: `@logs/client`

La opción más simple si tu app ya es Node. Batchea, reintenta con backoff y
nunca lanza una excepción hacia tu código (ver
[`packages/client/README.md`](../packages/client/README.md)):

```ts
import { LogClient } from '@logs/client';

const logs = new LogClient({ url: 'http://localhost:4000', apiKey: 'lk_...' });

logs.info('checkout', 'orden creada', { orderId: 123 });
logs.error('checkout', 'fallo el pago', { orderId: 123, err: 'card_declined' });

await logs.close(); // en tu propio shutdown
```

## curl

```bash
curl -X POST http://localhost:4000/v1/logs \
  -H "x-api-key: lk_..." \
  -H "content-type: application/json" \
  -d '{"level":"INFO","service":"checkout","message":"orden creada","metadata":{"orderId":123}}'
```

Para varios de una: `POST /v1/logs/bulk` con un array en vez de un objeto.

## Python

```python
import requests

requests.post(
    "http://localhost:4000/v1/logs",
    headers={"x-api-key": "lk_..."},
    json={"level": "INFO", "service": "checkout", "message": "orden creada"},
    timeout=5,
)
```

## Cualquier otro lenguaje

Un `POST` HTTP con `Content-Type: application/json` alcanza. Formato del
evento (ver [API.md](./API.md) y `packages/shared/src/log.ts`):

```json
{
  "level": "INFO",
  "service": "nombre-de-tu-servicio",
  "message": "texto libre",
  "timestamp": "2026-08-13T12:00:00Z",
  "metadata": { "cualquier": "campo" },
  "traceId": "opcional"
}
```

`level` es uno de `DEBUG`, `INFO`, `WARN`, `ERROR`, `FATAL`. `timestamp` es
opcional (default: ahora) y se rechaza si está a más de ±24h del reloj del
servidor — para no comerse relojes de cliente muy desincronizados sin darse
cuenta.
