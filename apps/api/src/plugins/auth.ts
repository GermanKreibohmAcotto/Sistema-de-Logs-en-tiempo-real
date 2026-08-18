import type { FastifyReply, FastifyRequest } from 'fastify';
import { validateApiKey } from '../ingest/api-keys.js';
import { consumeTokens } from './rate-limit.js';

/**
 * preHandler guard applied only to the ingest routes (POST /v1/logs and
 * /v1/logs/bulk) - reads happen through /v1/logs (GET) and the dashboard,
 * which are gated separately by DASHBOARD_TOKEN, not by producer API keys.
 */
export async function requireApiKey(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const rawKey = request.headers['x-api-key'];
  if (!rawKey || typeof rawKey !== 'string') {
    await reply.code(401).send({ error: 'missing_api_key' });
    return;
  }

  const lookup = await validateApiKey(rawKey);
  if (lookup.status === 'not_found') {
    await reply.code(401).send({ error: 'invalid_api_key' });
    return;
  }
  if (lookup.status === 'revoked') {
    await reply.code(403).send({ error: 'api_key_revoked' });
    return;
  }

  // A bulk request of N logs must cost N tokens, not 1 - otherwise the
  // limit is trivially evaded by batching everything into one request.
  const requestedTokens = Array.isArray(request.body) ? request.body.length || 1 : 1;
  const result = await consumeTokens(lookup.record.id, lookup.record.rateLimitRpm, requestedTokens);

  reply.header('X-RateLimit-Limit', result.limit);
  reply.header('X-RateLimit-Remaining', result.remaining);

  if (!result.allowed) {
    reply.header('Retry-After', result.retryAfterSeconds);
    await reply.code(429).send({
      error: 'rate_limit_exceeded',
      retryAfterSeconds: result.retryAfterSeconds,
    });
    return;
  }

  request.apiKeyId = lookup.record.id;
}
