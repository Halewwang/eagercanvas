import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { authUsers } from "./auth.js";
import { companyProviderKeys } from "./company_provider_keys.js";
import { agents } from "./agents.js";
import { costEvents } from "./cost_events.js";

export const providerRequestLogs = pgTable(
  "provider_request_logs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    userId: text("user_id").references(() => authUsers.id, { onDelete: "set null" }),
    providerKeyId: uuid("provider_key_id").references(() => companyProviderKeys.id, { onDelete: "set null" }),
    agentId: uuid("agent_id").references(() => agents.id, { onDelete: "set null" }),
    costEventId: uuid("cost_event_id").references(() => costEvents.id, { onDelete: "set null" }),
    externalRequestId: text("external_request_id").notNull(),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    requestMethod: text("request_method"),
    requestPath: text("request_path"),
    status: text("status").notNull().default("completed"),
    httpStatus: integer("http_status"),
    inputTokens: integer("input_tokens").notNull().default(0),
    cachedInputTokens: integer("cached_input_tokens").notNull().default(0),
    outputTokens: integer("output_tokens").notNull().default(0),
    costCents: integer("cost_cents"),
    requestStartedAt: timestamp("request_started_at", { withTimezone: true }).notNull().defaultNow(),
    requestCompletedAt: timestamp("request_completed_at", { withTimezone: true }),
    metadataJson: jsonb("metadata_json").$type<Record<string, unknown> | null>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyExternalRequestUq: uniqueIndex("provider_request_logs_company_external_request_uq").on(
      table.companyId,
      table.externalRequestId,
    ),
    companyUserStartedIdx: index("provider_request_logs_company_user_started_idx").on(
      table.companyId,
      table.userId,
      table.requestStartedAt,
    ),
    companyProviderKeyStartedIdx: index("provider_request_logs_company_provider_key_started_idx").on(
      table.companyId,
      table.providerKeyId,
      table.requestStartedAt,
    ),
    companyStartedIdx: index("provider_request_logs_company_started_idx").on(
      table.companyId,
      table.requestStartedAt,
    ),
  }),
);
