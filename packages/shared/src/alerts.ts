import { z } from 'zod';
import { logLevelSchema } from './log.js';

export const alertRuleInputSchema = z.object({
  name: z.string().min(1).max(128),
  levels: z.array(logLevelSchema).min(1),
  service: z.string().max(128).nullable().optional(),
  threshold: z.number().int().min(1),
  windowSeconds: z.number().int().min(1).max(3600),
  cooldownSeconds: z.number().int().min(0).max(86_400).default(60),
  enabled: z.boolean().default(true),
});
export type AlertRuleInput = z.infer<typeof alertRuleInputSchema>;

export const alertRuleSchema = alertRuleInputSchema.extend({
  id: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type AlertRule = z.infer<typeof alertRuleSchema>;

export const alertSchema = z.object({
  id: z.string(),
  ruleId: z.string(),
  ruleName: z.string(),
  count: z.number().int(),
  threshold: z.number().int(),
  windowSeconds: z.number().int(),
  triggeredAt: z.string(),
});
export type Alert = z.infer<typeof alertSchema>;
