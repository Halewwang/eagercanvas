import { z } from "zod";

const providerKeyStatusSchema = z.enum(["active", "disabled", "revoked"]);
const assignmentModeSchema = z.enum(["exclusive", "shared"]);

export const createCompanyProviderKeySchema = z.object({
  provider: z.string().trim().min(1),
  name: z.string().trim().min(1),
  externalKeyId: z.string().trim().min(1).optional().nullable(),
  secretId: z.string().uuid(),
  secretVersion: z.number().int().positive().optional().nullable(),
  allowSaveLogs: z.boolean().optional().default(false),
  allowManageKey: z.boolean().optional().default(false),
  limitCostCents: z.number().int().nonnegative().optional().nullable(),
  limitDailyCostCents: z.number().int().nonnegative().optional().nullable(),
  expiresAt: z.string().datetime().optional().nullable(),
  metadataJson: z.record(z.unknown()).optional().nullable(),
});

export type CreateCompanyProviderKey = z.infer<typeof createCompanyProviderKeySchema>;

export const updateCompanyProviderKeySchema = createCompanyProviderKeySchema.partial().extend({
  status: providerKeyStatusSchema.optional(),
});

export type UpdateCompanyProviderKey = z.infer<typeof updateCompanyProviderKeySchema>;

export const assignUserProviderKeySchema = z.object({
  providerKeyId: z.string().uuid(),
  assignmentMode: assignmentModeSchema.optional().default("exclusive"),
});

export type AssignUserProviderKey = z.infer<typeof assignUserProviderKeySchema>;

export const syncProviderKeyLogsSchema = z.object({
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional(),
  pageSize: z.number().int().positive().max(100).optional().default(100),
  maxPages: z.number().int().positive().max(10).optional().default(3),
});

export type SyncProviderKeyLogs = z.infer<typeof syncProviderKeyLogsSchema>;
