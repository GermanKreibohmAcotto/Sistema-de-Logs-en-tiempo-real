import { buildApp } from './app.js';
import { config } from './config.js';
import { logger } from './logger.js';
import { schedulePartitionMaintenance } from './maintenance/partitions.js';
import { writeBuffer } from './ingest/write-buffer.js';
import { pool } from './db/pool.js';
import { redisPub, redisCmd, redisSub } from './redis.js';
import { startStatsBroadcaster } from './realtime/stats-broadcaster.js';
import { startRulesCacheRefresh } from './alerts/rules-cache.js';

async function main(): Promise<void> {
  const app = await buildApp(); // also starts the Redis log subscriber the WS gateway needs
  const stopPartitionMaintenance = schedulePartitionMaintenance();
  const stopStatsBroadcaster = startStatsBroadcaster();
  const stopRulesCacheRefresh = startRulesCacheRefresh();

  await app.listen({ port: config.PORT, host: config.HOST });
  logger.info(`API escuchando en http://${config.HOST}:${config.PORT}`);

  let shuttingDown = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'Apagando...');
    try {
      stopPartitionMaintenance();
      stopStatsBroadcaster();
      stopRulesCacheRefresh();
      await app.close();
      // Flush whatever is still buffered so a restart never loses the last
      // batch that was accepted but not yet written to Postgres.
      await writeBuffer.flush();
      await pool.end();
      redisPub.disconnect();
      redisCmd.disconnect();
      redisSub.disconnect();
      process.exit(0);
    } catch (err) {
      logger.error({ err }, 'Error durante el apagado');
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

main().catch((err) => {
  console.error('Fallo al iniciar la API:', err);
  process.exit(1);
});
