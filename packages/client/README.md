# @logs/client

Cliente mínimo para mandar logs a la plataforma desde tu app Node o browser.
Sin dependencias (usa `fetch` global) — batchea, reintenta con backoff y nunca
lanza una excepción hacia tu código.

```ts
import { LogClient } from '@logs/client';

const logs = new LogClient({
  url: 'http://localhost:4000',
  apiKey: process.env.LOGS_API_KEY!,
});

logs.info('checkout', 'orden creada', { orderId: 123 });
logs.error('checkout', 'fallo el pago', { orderId: 123, err: 'card_declined' });

// En tu propio shutdown (SIGTERM, etc.):
await logs.close();
```

## API

- `new LogClient(options)` — `url`, `apiKey` requeridos. Opcionales:
  `maxBatchSize` (100), `flushIntervalMs` (2000), `maxRetries` (3), `onError`.
- `.debug/.info/.warn/.error/.fatal(service, message, metadata?)` — atajos sobre `.log()`.
- `.log(event)` — evento crudo (`LogEventInput` de `@logs/shared`).
- `.flush()` — envía el buffer ahora mismo.
- `.close()` — flushea y para el timer interno. Llamalo en tu shutdown.

Reintenta en `429`/`5xx` con backoff exponencial (respeta `Retry-After`); si se
agotan los reintentos, descarta el lote y llama a `onError` en vez de tirar
una excepción — un cliente de logging no debe poder tumbar la app que
monitorea.
