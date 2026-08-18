import { randomUUID } from 'node:crypto';
import { Pool } from 'undici';
import type { LogEventInput, LogLevel } from '@logs/shared';

interface Args {
  rate: number;
  duration: number;
  burst: number;
  batch: number;
  services: number;
  errorRate: number;
  url: string;
  apiKey?: string;
}

function parseArgs(argv: string[]): Args {
  if (argv.includes('--help') || argv.includes('-h')) {
    printUsage();
    process.exit(0);
  }
  const get = (flag: string, fallback: string): string => {
    const idx = argv.indexOf(flag);
    return idx >= 0 && argv[idx + 1] !== undefined ? argv[idx + 1]! : fallback;
  };
  return {
    rate: Number(get('--rate', '500')),
    duration: Number(get('--duration', '60')),
    burst: Number(get('--burst', '0')),
    batch: Number(get('--batch', '100')),
    services: Number(get('--services', '5')),
    errorRate: Number(get('--error-rate', '0.05')),
    url: get('--url', process.env.LOADGEN_TARGET_URL ?? 'http://localhost:4000'),
    apiKey: get('--api-key', process.env.LOADGEN_API_KEY ?? '') || undefined,
  };
}

function printUsage(): void {
  console.log(`Uso: npm run load -- [opciones]

  --rate <n>        logs/segundo sostenidos objetivo (default 500)
  --duration <s>     duracion en segundos del tramo sostenido (default 60)
  --burst <n>        rafaga inicial de N logs disparada de una sola vez antes del tramo sostenido (default 0)
  --batch <n>        tamano de cada POST /v1/logs/bulk (default 100)
  --services <n>      cantidad de servicios simulados distintos (default 5)
  --error-rate <0-1>  fraccion de eventos ERROR/FATAL (default 0.05)
  --url <url>        URL base de la API (default $LOADGEN_TARGET_URL o http://localhost:4000)
  --api-key <key>     API key de ingesta (default $LOADGEN_API_KEY)
`);
}

const MESSAGE_TEMPLATES: Record<LogLevel, string[]> = {
  DEBUG: ['cache hit for key %s', 'entrando al handler de %s', 'consulta a DB tardo %dms'],
  INFO: ['request completada', 'usuario inicio sesion en %s', 'job de %s finalizado'],
  WARN: [
    'reintentando conexion a %s',
    'respuesta lenta de %s (%dms)',
    'profundidad de cola alta: %d',
  ],
  ERROR: ['fallo al conectar con %s', 'timeout esperando a %s', 'excepcion no manejada en %s'],
  FATAL: ['memoria agotada en %s', 'pool de conexiones a DB agotado', 'panico en %s'],
};

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function randomLevel(errorRate: number): LogLevel {
  const r = Math.random();
  if (r < errorRate * 0.2) return 'FATAL';
  if (r < errorRate) return 'ERROR';
  if (r < errorRate + 0.15) return 'WARN';
  if (r < errorRate + 0.3) return 'DEBUG';
  return 'INFO';
}

function buildEvent(serviceNames: string[], errorRate: number): LogEventInput {
  const level = randomLevel(errorRate);
  const service = pick(serviceNames);
  const template = pick(MESSAGE_TEMPLATES[level]);
  const message = template
    .replace('%s', service)
    .replace('%d', String(Math.floor(Math.random() * 500)));
  return {
    level,
    service,
    message,
    metadata: { requestId: randomUUID(), latencyMs: Math.floor(Math.random() * 200) },
  };
}

interface Stats {
  batchesSent: number;
  logsSent: number;
  logsAccepted: number;
  logsRejected: number;
  requestsFailed: number;
  latenciesMs: number[];
  statusCodes: Map<number, number>;
}

function newStats(): Stats {
  return {
    batchesSent: 0,
    logsSent: 0,
    logsAccepted: 0,
    logsRejected: 0,
    requestsFailed: 0,
    latenciesMs: [],
    statusCodes: new Map(),
  };
}

function percentile(sortedMs: number[], p: number): number {
  if (sortedMs.length === 0) return 0;
  const idx = Math.min(sortedMs.length - 1, Math.floor((p / 100) * sortedMs.length));
  return sortedMs[idx]!;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const serviceNames = Array.from(
    { length: Math.max(1, args.services) },
    (_, i) => `service-${i + 1}`,
  );
  const pool = new Pool(args.url, { connections: 32, pipelining: 1 });
  const stats = newStats();

  async function sendBatch(events: LogEventInput[]): Promise<void> {
    const start = performance.now();
    stats.batchesSent++;
    stats.logsSent += events.length;
    try {
      const res = await pool.request({
        path: '/v1/logs/bulk',
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(args.apiKey ? { 'x-api-key': args.apiKey } : {}),
        },
        body: JSON.stringify(events),
      });
      const latencyMs = performance.now() - start;
      stats.latenciesMs.push(latencyMs);
      stats.statusCodes.set(res.statusCode, (stats.statusCodes.get(res.statusCode) ?? 0) + 1);

      const bodyText = await res.body.text();
      if (res.statusCode >= 200 && res.statusCode < 300) {
        try {
          const parsed = JSON.parse(bodyText) as { accepted?: number; rejected?: unknown[] };
          stats.logsAccepted += parsed.accepted ?? events.length;
          stats.logsRejected += parsed.rejected?.length ?? 0;
        } catch {
          stats.logsAccepted += events.length;
        }
      } else {
        stats.requestsFailed++;
        stats.logsRejected += events.length;
      }
    } catch {
      const latencyMs = performance.now() - start;
      stats.latenciesMs.push(latencyMs);
      stats.requestsFailed++;
      stats.logsRejected += events.length;
    }
  }

  function chunk(total: number): number[] {
    const sizes: number[] = [];
    let remaining = total;
    while (remaining > 0) {
      const size = Math.min(args.batch, remaining);
      sizes.push(size);
      remaining -= size;
    }
    return sizes;
  }

  console.log(
    `Cargando ${args.url} - rate=${args.rate}/s duration=${args.duration}s burst=${args.burst} batch=${args.batch} services=${serviceNames.length} errorRate=${args.errorRate}`,
  );

  const overallStart = performance.now();

  if (args.burst > 0) {
    console.log(`Disparando rafaga de ${args.burst} logs...`);
    const burstSizes = chunk(args.burst);
    await Promise.all(
      burstSizes.map((size) =>
        sendBatch(Array.from({ length: size }, () => buildEvent(serviceNames, args.errorRate))),
      ),
    );
    console.log('Rafaga enviada.');
  }

  const TICK_MS = 200;
  const ticksTotal = Math.ceil((args.duration * 1000) / TICK_MS);
  const perTickTarget = (args.rate * TICK_MS) / 1000;
  let carry = 0;

  for (let tick = 0; tick < ticksTotal; tick++) {
    const tickStart = Date.now();
    carry += perTickTarget;
    const logsThisTick = Math.floor(carry);
    carry -= logsThisTick;

    const sizes = chunk(logsThisTick);
    await Promise.all(
      sizes.map((size) =>
        sendBatch(Array.from({ length: size }, () => buildEvent(serviceNames, args.errorRate))),
      ),
    );

    const elapsed = Date.now() - tickStart;
    const sleepMs = TICK_MS - elapsed;
    if (sleepMs > 0) await sleep(sleepMs);
  }

  const totalSeconds = (performance.now() - overallStart) / 1000;
  await pool.close();

  const sorted = [...stats.latenciesMs].sort((a, b) => a - b);
  const throughput = stats.logsSent / totalSeconds;

  console.log('\n=== Resultados ===');
  console.log(`Duracion real: ${totalSeconds.toFixed(1)}s`);
  console.log(`Batches enviados: ${stats.batchesSent}`);
  console.log(`Logs enviados: ${stats.logsSent}`);
  console.log(`Logs aceptados: ${stats.logsAccepted}`);
  console.log(`Logs rechazados: ${stats.logsRejected}`);
  console.log(`Requests fallidos (red o no-2xx): ${stats.requestsFailed}`);
  console.log(`Throughput real: ${throughput.toFixed(1)} logs/s`);
  console.log(
    `Latencia por batch (ms): p50=${percentile(sorted, 50).toFixed(1)} p95=${percentile(sorted, 95).toFixed(1)} p99=${percentile(sorted, 99).toFixed(1)} max=${(sorted[sorted.length - 1] ?? 0).toFixed(1)}`,
  );
  console.log('Codigos de estado:', Object.fromEntries(stats.statusCodes));

  if (stats.requestsFailed > 0) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('Fallo el generador de carga:', err);
  process.exit(1);
});
