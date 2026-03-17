import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { companySecrets } from "./company_secrets.js";

export const companyProviderKeys = pgTable(
  "company_provider_keys",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    provider: text("provider").notNull(),
    name: text("name").notNull(),
    externalKeyId: text("external_key_id"),
    secretId: uuid("secret_id").notNull().references(() => companySecrets.id),
    secretVersion: integer("secret_version"),
    status: text("status").notNull().default("active"),
    allowSaveLogs: boolean("allow_save_logs").notNull().default(false),
    allowManageKey: boolean("allow_manage_key").notNull().default(false),
    limitCostCents: integer("limit_cost_cents"),
    limitDailyCostCents: integer("limit_daily_cost_cents"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
    metadataJson: jsonb("metadata_json").$type<Record<string, unknown> | null>(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyProviderNameUq: uniqueIndex("company_provider_keys_company_provider_name_uq").on(
      table.companyId,
      table.provider,
      table.name,
    ),
    companyStatusIdx: index("company_provider_keys_company_status_idx").on(table.companyId, table.status),
    companyProviderIdx: index("company_provider_keys_company_provider_idx").on(table.companyId, table.provider),
    secretIdx: index("company_provider_keys_secret_idx").on(table.secretId),
  }),
);
