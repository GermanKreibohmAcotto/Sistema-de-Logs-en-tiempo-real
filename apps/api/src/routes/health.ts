import type { FastifyPluginAsync } from 'fastify';
import { writeBuffer } from '../ingest/write-buffer.js';

export const healthRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get('/health', async () => ({
    status: 'ok',
    writeBuffer: {
      pending: writeBuffer.pendingCount,
      droppedTotal: writeBuffer.droppedTotal,
    },
  }));
};
