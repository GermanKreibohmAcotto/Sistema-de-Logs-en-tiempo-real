import { randomBytes } from 'node:crypto';
import { redisCmd } from '../redis.js';

const TTL_SECONDS = 60;
const KEY_PREFIX = 'export-ticket:';

/**
 * `window.location.href = url` (the export download) is a browser navigation,
 * so it can't carry the x-dashboard-token header. A short-lived, single-use
 * ticket lets the real token stay in a header on the POST that mints it,
 * while only a throwaway value (expires in 60s, works once) ends up in the
 * URL and browser history.
 */
export async function createExportTicket(): Promise<string> {
  const ticket = randomBytes(24).toString('hex');
  await redisCmd.set(KEY_PREFIX + ticket, '1', 'EX', TTL_SECONDS);
  return ticket;
}

export async function consumeExportTicket(ticket: string | undefined): Promise<boolean> {
  if (!ticket) return false;
  const existed = await redisCmd.getdel(KEY_PREFIX + ticket);
  return existed !== null;
}
