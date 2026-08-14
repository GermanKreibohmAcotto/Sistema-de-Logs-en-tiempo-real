import { timingSafeEqual } from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { config } from '../config.js';

function tokensMatch(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** DASHBOARD_TOKEN empty => local/dev mode, always valid (see startup warning in server.ts). */
export function isDashboardTokenValid(token: string | undefined): boolean {
  if (!config.DASHBOARD_TOKEN) return true;
  return typeof token === 'string' && tokensMatch(token, config.DASHBOARD_TOKEN);
}

/** preHandler guarding dashboard reads (query/stats/alerts) and the export ticket route. */
export async function requireDashboardToken(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const header = request.headers['x-dashboard-token'];
  if (!isDashboardTokenValid(typeof header === 'string' ? header : undefined)) {
    await reply.code(401).send({ error: 'invalid_dashboard_token' });
  }
}
