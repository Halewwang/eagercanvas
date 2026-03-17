import { z } from "zod";
import { BILLING_TYPES } from "../constants.js";

export const createCostEventSchema = z.object({
  agentId: z.string().uuid(),
  userId: z.string().min(1).optional().nullable(),
  providerKeyId: z.string().uuid().optional().nullable(),
  externalRequestId: z.string().min(1).optional().nullable(),
  issueId: z.string().uuid().optional().nullable(),
  projectId: z.string().uuid().optional().nullable(),
  goalId: z.string().uuid().optional().nullable(),
  heartbeatRunId: z.string().uuid().optional().nullable(),
  billingCode: z.string().optional().nullable(),
  provider: z.string().min(1),
  biller: z.string().min(1).optional(),
  billingType: z.enum(BILLING_TYPES).optional().default("unknown"),
  model: z.string().min(1),
  inputTokens: z.number().int().nonnegative().optional().default(0),
  cachedInputTokens: z.number().int().nonnegative().optional().default(0),
  outputTokens: z.number().int().nonnegative().optional().default(0),
  costCents: z.number().int().nonnegative(),
  occurredAt: z.string().datetime(),
}).transform((value) => ({
  ...value,
  biller: value.biller ?? value.provider,
}));

export type CreateCostEvent = z.infer<typeof createCostEventSchema>;

export const createProviderRequestLogSchema = z.object({
  userId: z.string().min(1).optional().nullable(),
  providerKeyId: z.string().uuid().optional().nullable(),
  agentId: z.string().uuid().optional().nullable(),
  costEventId: z.string().uuid().optional().nullable(),
  externalRequestId: z.string().min(1),
  provider: z.string().min(1),
  model: z.string().min(1),
  requestMethod: z.string().min(1).optional().nullable(),
  requestPath: z.string().min(1).optional().nullable(),
  status: z.string().min(1).optional().default("completed"),
  httpStatus: z.number().int().nonnegative().optional().nullable(),
  inputTokens: z.number().int().nonnegative().optional().default(0),
  cachedInputTokens: z.number().int().nonnegative().optional().default(0),
  outputTokens: z.number().int().nonnegative().optional().default(0),
  costCents: z.number().int().nonnegative().optional().nullable(),
  requestStartedAt: z.string().datetime(),
  requestCompletedAt: z.string().datetime().optional().nullable(),
  metadataJson: z.record(z.string(), z.unknown()).optional().nullable(),
});

export type CreateProviderRequestLog = z.infer<typeof createProviderRequestLogSchema>;

export const updateBudgetSchema = z.object({
  budgetMonthlyCents: z.number().int().nonnegative(),
});

export type UpdateBudget = z.infer<typeof updateBudgetSchema>;
