import { randomUUID } from 'node:crypto';
import type { FastifyPluginAsync } from 'fastify';
import { logEventInputSchema, type LogEvent, type LogEventInput } from '@logs/shared';
import { config } from '../config.js';
import { writeBuffer, type BufferedRow } from '../ingest/write-buffer.js';
import { publisher } from '../ingest/publisher.js';
import { recordRateCounters } from '../ingest/rate-counters.js';
import { evaluateIngestedBatch } from '../alerts/engine.js';
import { requireApiKey } from '../plugins/auth.js';

function toEventAndRow(
  input: LogEventInput,
  apiKeyId: number | null,
): { event: LogEvent; row: BufferedRow } {
  const ts = input.timestamp ?? new Date().toISOString();
  const event: LogEvent = {
    id: randomUUID(),
    timestamp: ts,
    level: input.level,
    service: input.service,
    message: input.message,
    metadata: input.metadata ?? null,
    traceId: input.traceId ?? null,
    ingestedAt: new Date().toISOString(),
  };
  const row: BufferedRow = {
    ts,
    level: input.level,
    service: input.service,
    message: input.message,
    metadata: input.metadata ? JSON.stringify(input.metadata) : null,
    traceId: input.traceId ?? null,
    apiKeyId,
  };
  return { event, row };
}

export const ingestRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/v1/logs', { preHandler: requireApiKey }, async (request, reply) => {
    const parsed = logEventInputSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: 'invalid_payload', details: parsed.error.flatten() });
    }

    const { event, row } = toEventAndRow(parsed.data, request.apiKeyId ?? null);
    const accepted = writeBuffer.push(row);
    if (!accepted) {
      return reply.code(503).send({ error: 'buffer_full' });
    }

    publisher.push(event);
    evaluateIngestedBatch([event]);
    void recordRateCounters([event]);

    if (config.INGEST_SYNC) {
      await writeBuffer.flush();
    }

    return reply.code(202).send({ accepted: 1 });
  });

  fastify.post('/v1/logs/bulk', { preHandler: requireApiKey }, async (request, reply) => {
    const body = request.body;
    if (!Array.isArray(body)) {
      return reply.code(400).send({ error: 'expected_array' });
    }
    if (body.length === 0) {
      return reply.code(400).send({ error: 'empty_array' });
    }
    if (body.length > config.BULK_MAX_ITEMS) {
      return reply.code(400).send({ error: 'too_many_items', max: config.BULK_MAX_ITEMS });
    }

    const rejected: { index: number; error: string }[] = [];
    const events: LogEvent[] = [];
    let bufferFull = false;
    const apiKeyId = request.apiKeyId ?? null;

    for (let index = 0; index < body.length; index++) {
      const parsed = logEventInputSchema.safeParse(body[index]);
      if (!parsed.success) {
        rejected.push({ index, error: parsed.error.issues.map((i) => i.message).join('; ') });
        continue;
      }
      const { event, row } = toEventAndRow(parsed.data, apiKeyId);
      const accepted = writeBuffer.push(row);
      if (!accepted) {
        bufferFull = true;
        rejected.push({ index, error: 'buffer_full' });
        continue;
      }
      events.push(event);
    }

    if (events.length > 0) {
      for (const event of events) publisher.push(event);
      evaluateIngestedBatch(events);
      void recordRateCounters(events);
    }

    if (config.INGEST_SYNC && events.length > 0) {
      await writeBuffer.flush();
    }

    return reply.code(bufferFull ? 503 : 202).send({ accepted: events.length, rejected });
  });
};
