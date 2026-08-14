import type { LogEventInput } from '@logs/shared';

export interface LogClientOptions {
  /** URL base de la API, p.ej. http://localhost:4000 */
  url: string;
  apiKey: string;
  /** Envia el lote apenas se junten esta cantidad de eventos. Default 100. */
  maxBatchSize?: number;
  /** Envia el lote en este intervalo aunque no se llegue a maxBatchSize. Default 2000ms. */
  flushIntervalMs?: number;
  /** Reintentos ante 5xx/429 antes de descartar el lote. Default 3. */
  maxRetries?: number;
  /**
   * Se llama cuando un lote se descarta tras agotar los reintentos. Por
   * default solo hace console.error - un cliente de logging nunca debe tirar
   * abajo la app que esta monitoreando.
   */
  onError?: (err: unknown) => void;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class LogClient {
  private buffer: LogEventInput[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private closed = false;
  private readonly opts: Required<Omit<LogClientOptions, 'onError'>> & {
    onError: (err: unknown) => void;
  };

  constructor(options: LogClientOptions) {
    this.opts = {
      url: options.url.replace(/\/$/, ''),
      apiKey: options.apiKey,
      maxBatchSize: options.maxBatchSize ?? 100,
      flushIntervalMs: options.flushIntervalMs ?? 2000,
      maxRetries: options.maxRetries ?? 3,
      onError:
        options.onError ?? ((err) => console.error('[@logs/client] lote de logs descartado:', err)),
    };

    this.timer = setInterval(() => void this.flush(), this.opts.flushIntervalMs);
    // Nunca mantiene vivo un proceso Node por si solo - close()/beforeExit
    // cubren el flush final; unref no existe en el setInterval del browser.
    this.timer.unref?.();

    // Red de seguridad para scripts cortos que se olvidan de llamar close().
    // No se engancha a SIGTERM/SIGINT: la app anfitriona puede tener su
    // propio manejador de apagado (p.ej. apps/api/src/server.ts) y agregar
    // uno propio aca competiria por el control del cierre del proceso.
    if (typeof process !== 'undefined' && typeof process.once === 'function') {
      process.once('beforeExit', () => void this.flush());
    }
  }

  log(event: LogEventInput): void {
    if (this.closed) return;
    this.buffer.push(event);
    if (this.buffer.length >= this.opts.maxBatchSize) void this.flush();
  }

  debug(service: string, message: string, metadata?: Record<string, unknown>): void {
    this.log({ level: 'DEBUG', service, message, metadata });
  }
  info(service: string, message: string, metadata?: Record<string, unknown>): void {
    this.log({ level: 'INFO', service, message, metadata });
  }
  warn(service: string, message: string, metadata?: Record<string, unknown>): void {
    this.log({ level: 'WARN', service, message, metadata });
  }
  error(service: string, message: string, metadata?: Record<string, unknown>): void {
    this.log({ level: 'ERROR', service, message, metadata });
  }
  fatal(service: string, message: string, metadata?: Record<string, unknown>): void {
    this.log({ level: 'FATAL', service, message, metadata });
  }

  /** Envia lo que este bufferizado ahora mismo. Nunca lanza - ver `onError`. */
  async flush(): Promise<void> {
    if (this.buffer.length === 0) return;
    const batch = this.buffer;
    this.buffer = [];
    await this.postWithRetry(batch);
  }

  /** Flushea y para el timer. Llamalo en tu propio shutdown (SIGTERM, etc). */
  async close(): Promise<void> {
    this.closed = true;
    if (this.timer) clearInterval(this.timer);
    await this.flush();
  }

  private async postWithRetry(batch: LogEventInput[]): Promise<void> {
    for (let attempt = 0; ; attempt++) {
      try {
        const res = await fetch(`${this.opts.url}/v1/logs/bulk`, {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-api-key': this.opts.apiKey },
          body: JSON.stringify(batch),
        });
        if (res.ok) return;
        if (!this.shouldRetry(res.status, attempt)) {
          this.opts.onError(new Error(`ingesta de logs fallo: ${res.status} ${res.statusText}`));
          return;
        }
        await sleep(this.retryDelayMs(res, attempt));
      } catch (err) {
        if (attempt >= this.opts.maxRetries) {
          this.opts.onError(err);
          return;
        }
        await sleep(this.retryDelayMs(null, attempt));
      }
    }
  }

  private shouldRetry(status: number, attempt: number): boolean {
    return (status === 429 || status >= 500) && attempt < this.opts.maxRetries;
  }

  private retryDelayMs(res: Response | null, attempt: number): number {
    const retryAfter = res ? Number(res.headers.get('retry-after')) : NaN;
    if (Number.isFinite(retryAfter) && retryAfter > 0) return retryAfter * 1000;
    return Math.min(30_000, 500 * 2 ** attempt);
  }
}
