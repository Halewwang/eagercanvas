import {
  pgTable,
  uuid,
  text,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { companies } from "./companies.js";
import { authUsers } from "./auth.js";
import { companyProviderKeys } from "./company_provider_keys.js";

export const userProviderKeyAssignments = pgTable(
  "user_provider_key_assignments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    companyId: uuid("company_id").notNull().references(() => companies.id),
    userId: text("user_id").notNull().references(() => authUsers.id, { onDelete: "cascade" }),
    providerKeyId: uuid("provider_key_id").notNull().references(() => companyProviderKeys.id, { onDelete: "cascade" }),
    assignmentMode: text("assignment_mode").notNull().default("exclusive"),
    assignedByUserId: text("assigned_by_user_id").references(() => authUsers.id, { onDelete: "set null" }),
    assignedAt: timestamp("assigned_at", { withTimezone: true }).notNull().defaultNow(),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => ({
    companyUserProviderKeyUq: uniqueIndex("user_provider_key_assignments_company_user_provider_key_uq").on(
      table.companyId,
      table.userId,
      table.providerKeyId,
    ),
    companyUserIdx: index("user_provider_key_assignments_company_user_idx").on(
      table.companyId,
      table.userId,
      table.revokedAt,
    ),
    companyProviderKeyIdx: index("user_provider_key_assignments_company_provider_key_idx").on(
      table.companyId,
      table.providerKeyId,
      table.revokedAt,
    ),
  }),
);
