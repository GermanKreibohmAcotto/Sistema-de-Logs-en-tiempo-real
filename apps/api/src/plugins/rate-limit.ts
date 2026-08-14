import { redisCmd } from '../redis.js';

/**
 * Atomic token bucket implemented as a Lua script so read-modify-write never
 * races under concurrent requests for the same key. Capacity = rpm,
 * refilling continuously at rpm/60 tokens/second. `requested` lets a single
 * call consume more than one token - critical for /v1/logs/bulk, where a
 * batch of 1000 logs must cost 1000 tokens, not 1, or the limit is
 * trivially evaded by batching everything into one request.
 */
const TOKEN_BUCKET_SCRIPT = `
local key = KEYS[1]
local capacity = tonumber(ARGV[1])
local refill_rate = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
local requested = tonumber(ARGV[4])

local bucket = redis.call('HMGET', key, 'tokens', 'ts')
local tokens = tonumber(bucket[1])
local ts = tonumber(bucket[2])

if tokens == nil then
  tokens = capacity
  ts = now
end

local elapsed = math.max(0, now - ts)
tokens = math.min(capacity, tokens + elapsed * refill_rate)

local allowed = 0
if tokens >= requested then
  tokens = tokens - requested
  allowed = 1
end

redis.call('HMSET', key, 'tokens', tokens, 'ts', now)
redis.call('EXPIRE', key, 120)

return { allowed, tostring(tokens) }
`;

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
}

export async function consumeTokens(
  apiKeyId: number,
  rpm: number,
  requested: number,
): Promise<RateLimitResult> {
  const key = `ratelimit:${apiKeyId}`;
  const refillRate = rpm / 60;
  const now = Date.now() / 1000;

  const [allowedFlag, tokensStr] = (await redisCmd.eval(
    TOKEN_BUCKET_SCRIPT,
    1,
    key,
    rpm,
    refillRate,
    now,
    requested,
  )) as [number, string];

  const tokens = Number(tokensStr);
  const allowed = allowedFlag === 1;
  const retryAfterSeconds = allowed
    ? 0
    : Math.max(1, Math.ceil((requested - tokens) / refillRate));

  return { allowed, limit: rpm, remaining: Math.max(0, Math.floor(tokens)), retryAfterSeconds };
}
