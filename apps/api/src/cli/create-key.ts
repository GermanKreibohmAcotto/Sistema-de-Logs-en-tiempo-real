import { createApiKey } from '../ingest/api-keys.js';
import { pool } from '../db/pool.js';
import { redisPub, redisCmd, redisSub } from '../redis.js';

async function main(): Promise<void> {
  const [, , name, rpmArg] = process.argv;
  if (!name) {
    console.error('Uso: npm run keys:create -- <nombre> [rate_limit_rpm=6000]');
    process.exit(1);
  }
  const rpm = rpmArg ? Number(rpmArg) : 6000;

  const { rawKey, record } = await createApiKey(name, rpm);

  console.log('API key creada. Guardala ahora: no se puede volver a mostrar.\n');
  console.log(`  ${rawKey}\n`);
  console.log(`id=${record.id} name=${record.name} rateLimitRpm=${record.rateLimitRpm}`);

  // api-keys.ts caches through redisCmd, so importing it opens all three
  // ioredis connections (redis.ts creates them eagerly on import) - without
  // closing them the event loop never drains and the CLI hangs forever
  // instead of exiting after printing the key.
  await pool.end();
  redisPub.disconnect();
  redisCmd.disconnect();
  redisSub.disconnect();
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
