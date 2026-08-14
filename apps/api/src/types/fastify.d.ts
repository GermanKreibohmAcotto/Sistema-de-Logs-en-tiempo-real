import 'fastify';

declare module 'fastify' {
  interface FastifyRequest {
    /** Set by plugins/auth.ts once an API key has been validated. */
    apiKeyId?: number;
  }
}
