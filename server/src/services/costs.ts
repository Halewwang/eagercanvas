import { and, desc, eq, gte, isNotNull, lt, lte, sql } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import {
  activityLog,
  agents,
  authUsers,
  companies,
  companyMemberships,
  companyProviderKeys,
  costEvents,
  issues,
  projects,
  providerRequestLogs,
} from "@paperclipai/db";
import { notFound, unprocessable } from "../errors.js";
import { budgetService, type BudgetServiceHooks } from "./budgets.js";

export interface CostDateRange {
  from?: Date;
  to?: Date;
}

const METERED_BILLING_TYPE = "metered_api";
const SUBSCRIPTION_BILLING_TYPES = ["subscription_included", "subscription_overage"] as const;

function currentUtcMonthWindow(now = new Date()) {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  return {
    start: new Date(Date.UTC(year, month, 1, 0, 0, 0, 0)),
    end: new Date(Date.UTC(year, month + 1, 1, 0, 0, 0, 0)),
  };
}

async function assertUserBelongsToCompany(db: Db, companyId: string, userId: string) {
  const membership = await db
    .select({ userId: companyMemberships.principalId })
    .from(companyMemberships)
    .where(
      and(
        eq(companyMemberships.companyId, companyId),
        eq(companyMemberships.principalType, "user"),
        eq(companyMemberships.principalId, userId),
      ),
    )
    .then((rows) => rows[0] ?? null);

  if (!membership) {
    throw unprocessable("User does not belong to company");
  }
}

async function assertProviderKeyBelongsToCompany(db: Db, companyId: string, providerKeyId: string) {
  const providerKey = await db
    .select({ id: companyProviderKeys.id })
    .from(companyProviderKeys)
    .where(
      and(
        eq(companyProviderKeys.companyId, companyId),
        eq(companyProviderKeys.id, providerKeyId),
      ),
    )
    .then((rows) => rows[0] ?? null);

  if (!providerKey) {
    throw unprocessable("Provider key does not belong to company");
  }
}

async function getMonthlySpendTotal(
  db: Db,
  scope: { companyId: string; agentId?: string | null },
) {
  const { start, end } = currentUtcMonthWindow();
  const conditions = [
    eq(costEvents.companyId, scope.companyId),
    gte(costEvents.occurredAt, start),
    lt(costEvents.occurredAt, end),
  ];
  if (scope.agentId) {
    conditions.push(eq(costEvents.agentId, scope.agentId));
  }
  const [row] = await db
    .select({
      total: sql<number>`coalesce(sum(${costEvents.costCents}), 0)::int`,
    })
    .from(costEvents)
    .where(and(...conditions));
  return Number(row?.total ?? 0);
}

export function costService(db: Db, budgetHooks: BudgetServiceHooks = {}) {
  const budgets = budgetService(db, budgetHooks);
  return {
    createEvent: async (companyId: string, data: Omit<typeof costEvents.$inferInsert, "companyId">) => {
      const agent = await db
        .select()
        .from(agents)
        .where(eq(agents.id, data.agentId))
        .then((rows) => rows[0] ?? null);

      if (!agent) throw notFound("Agent not found");
      if (agent.companyId !== companyId) {
        throw unprocessable("Agent does not belong to company");
      }
      if (data.userId) {
        await assertUserBelongsToCompany(db, companyId, data.userId);
      }
      if (data.providerKeyId) {
        await assertProviderKeyBelongsToCompany(db, companyId, data.providerKeyId);
      }

      const event = await db
        .insert(costEvents)
        .values({
          ...data,
          companyId,
          biller: data.biller ?? data.provider,
          billingType: data.billingType ?? "unknown",
          cachedInputTokens: data.cachedInputTokens ?? 0,
        })
        .returning()
        .then((rows) => rows[0]);

      const [agentMonthSpend, companyMonthSpend] = await Promise.all([
        getMonthlySpendTotal(db, { companyId, agentId: event.agentId }),
        getMonthlySpendTotal(db, { companyId }),
      ]);

      await db
        .update(agents)
        .set({
          spentMonthlyCents: agentMonthSpend,
          updatedAt: new Date(),
        })
        .where(eq(agents.id, event.agentId));

      await db
        .update(companies)
        .set({
          spentMonthlyCents: companyMonthSpend,
          updatedAt: new Date(),
        })
        .where(eq(companies.id, companyId));

      await budgets.evaluateCostEvent(event);

      return event;
    },

    createProviderRequestLog: async (
      companyId: string,
      data: Omit<typeof providerRequestLogs.$inferInsert, "companyId">,
    ) => {
      if (data.userId) {
        await assertUserBelongsToCompany(db, companyId, data.userId);
      }
      if (data.providerKeyId) {
        await assertProviderKeyBelongsToCompany(db, companyId, data.providerKeyId);
      }
      if (data.agentId) {
        const agent = await db
          .select({ id: agents.id, companyId: agents.companyId })
          .from(agents)
          .where(eq(agents.id, data.agentId))
          .then((rows) => rows[0] ?? null);
        if (!agent) throw notFound("Agent not found");
        if (agent.companyId !== companyId) {
          throw unprocessable("Agent does not belong to company");
        }
      }
      if (data.costEventId) {
        const costEvent = await db
          .select({ id: costEvents.id, companyId: costEvents.companyId })
          .from(costEvents)
          .where(eq(costEvents.id, data.costEventId))
          .then((rows) => rows[0] ?? null);
        if (!costEvent) throw notFound("Cost event not found");
        if (costEvent.companyId !== companyId) {
          throw unprocessable("Cost event does not belong to company");
        }
      }

      return db
        .insert(providerRequestLogs)
        .values({
          ...data,
          companyId,
          cachedInputTokens: data.cachedInputTokens ?? 0,
          inputTokens: data.inputTokens ?? 0,
          outputTokens: data.outputTokens ?? 0,
          status: data.status ?? "completed",
        })
        .returning()
        .then((rows) => rows[0]);
    },

    upsertProviderRequestLog: async (
      companyId: string,
      data: Omit<typeof providerRequestLogs.$inferInsert, "companyId">,
    ) => {
      const existing = await db
        .select()
        .from(providerRequestLogs)
        .where(
          and(
            eq(providerRequestLogs.companyId, companyId),
            eq(providerRequestLogs.externalRequestId, data.externalRequestId),
          ),
        )
        .then((rows) => rows[0] ?? null);

      if (!existing) {
        return {
          log: await db
            .insert(providerRequestLogs)
            .values({
              ...data,
              companyId,
              cachedInputTokens: data.cachedInputTokens ?? 0,
              inputTokens: data.inputTokens ?? 0,
              outputTokens: data.outputTokens ?? 0,
              status: data.status ?? "completed",
            })
            .returning()
            .then((rows) => rows[0]),
          matchedExisting: false,
        };
      }

      const merged = {
        userId: data.userId ?? existing.userId,
        providerKeyId: data.providerKeyId ?? existing.providerKeyId,
        agentId: data.agentId ?? existing.agentId,
        costEventId: data.costEventId ?? existing.costEventId,
        provider: data.provider,
        model: data.model,
        requestMethod: data.requestMethod ?? existing.requestMethod,
        requestPath: data.requestPath ?? existing.requestPath,
        status: data.status ?? existing.status,
        httpStatus: data.httpStatus ?? existing.httpStatus,
        inputTokens: data.inputTokens ?? existing.inputTokens,
        cachedInputTokens: data.cachedInputTokens ?? existing.cachedInputTokens,
        outputTokens: data.outputTokens ?? existing.outputTokens,
        costCents: data.costCents ?? existing.costCents,
        requestStartedAt: data.requestStartedAt ?? existing.requestStartedAt,
        requestCompletedAt: data.requestCompletedAt ?? existing.requestCompletedAt,
        metadataJson:
          data.metadataJson || existing.metadataJson
            ? {
              ...(existing.metadataJson ?? {}),
              ...(data.metadataJson ?? {}),
            }
            : null,
        updatedAt: new Date(),
      } satisfies Partial<typeof providerRequestLogs.$inferInsert>;

      if (merged.userId) {
        await assertUserBelongsToCompany(db, companyId, merged.userId);
      }
      if (merged.providerKeyId) {
        await assertProviderKeyBelongsToCompany(db, companyId, merged.providerKeyId);
      }
      if (merged.agentId) {
        const agent = await db
          .select({ id: agents.id, companyId: agents.companyId })
          .from(agents)
          .where(eq(agents.id, merged.agentId))
          .then((rows) => rows[0] ?? null);
        if (!agent) throw notFound("Agent not found");
        if (agent.companyId !== companyId) {
          throw unprocessable("Agent does not belong to company");
        }
      }
      if (merged.costEventId) {
        const costEvent = await db
          .select({ id: costEvents.id, companyId: costEvents.companyId })
          .from(costEvents)
          .where(eq(costEvents.id, merged.costEventId))
          .then((rows) => rows[0] ?? null);
        if (!costEvent) throw notFound("Cost event not found");
        if (costEvent.companyId !== companyId) {
          throw unprocessable("Cost event does not belong to company");
        }
      }

      return {
        log: await db
          .update(providerRequestLogs)
          .set(merged)
          .where(eq(providerRequestLogs.id, existing.id))
          .returning()
          .then((rows) => rows[0]),
        matchedExisting: true,
      };
    },

    summary: async (companyId: string, range?: CostDateRange) => {
      const company = await db
        .select()
        .from(companies)
        .where(eq(companies.id, companyId))
        .then((rows) => rows[0] ?? null);

      if (!company) throw notFound("Company not found");

      const conditions: ReturnType<typeof eq>[] = [eq(costEvents.companyId, companyId)];
      if (range?.from) conditions.push(gte(costEvents.occurredAt, range.from));
      if (range?.to) conditions.push(lte(costEvents.occurredAt, range.to));

      const [{ total }] = await db
        .select({
          total: sql<number>`coalesce(sum(${costEvents.costCents}), 0)::int`,
        })
        .from(costEvents)
        .where(and(...conditions));

      const spendCents = Number(total);
      const utilization =
        company.budgetMonthlyCents > 0
          ? (spendCents / company.budgetMonthlyCents) * 100
          : 0;

      return {
        companyId,
        spendCents,
        budgetCents: company.budgetMonthlyCents,
        utilizationPercent: Number(utilization.toFixed(2)),
      };
    },

    byAgent: async (companyId: string, range?: CostDateRange) => {
      const conditions: ReturnType<typeof eq>[] = [eq(costEvents.companyId, companyId)];
      if (range?.from) conditions.push(gte(costEvents.occurredAt, range.from));
      if (range?.to) conditions.push(lte(costEvents.occurredAt, range.to));

      return db
        .select({
          agentId: costEvents.agentId,
          agentName: agents.name,
          agentStatus: agents.status,
          costCents: sql<number>`coalesce(sum(${costEvents.costCents}), 0)::int`,
          inputTokens: sql<number>`coalesce(sum(${costEvents.inputTokens}), 0)::int`,
          cachedInputTokens: sql<number>`coalesce(sum(${costEvents.cachedInputTokens}), 0)::int`,
          outputTokens: sql<number>`coalesce(sum(${costEvents.outputTokens}), 0)::int`,
          apiRunCount:
            sql<number>`count(distinct case when ${costEvents.billingType} = ${METERED_BILLING_TYPE} then ${costEvents.heartbeatRunId} end)::int`,
          subscriptionRunCount:
            sql<number>`count(distinct case when ${costEvents.billingType} in (${sql.join(SUBSCRIPTION_BILLING_TYPES.map((value) => sql`${value}`), sql`, `)}) then ${costEvents.heartbeatRunId} end)::int`,
          subscriptionCachedInputTokens:
            sql<number>`coalesce(sum(case when ${costEvents.billingType} in (${sql.join(SUBSCRIPTION_BILLING_TYPES.map((value) => sql`${value}`), sql`, `)}) then ${costEvents.cachedInputTokens} else 0 end), 0)::int`,
          subscriptionInputTokens:
            sql<number>`coalesce(sum(case when ${costEvents.billingType} in (${sql.join(SUBSCRIPTION_BILLING_TYPES.map((value) => sql`${value}`), sql`, `)}) then ${costEvents.inputTokens} else 0 end), 0)::int`,
          subscriptionOutputTokens:
            sql<number>`coalesce(sum(case when ${costEvents.billingType} in (${sql.join(SUBSCRIPTION_BILLING_TYPES.map((value) => sql`${value}`), sql`, `)}) then ${costEvents.outputTokens} else 0 end), 0)::int`,
        })
        .from(costEvents)
        .leftJoin(agents, eq(costEvents.agentId, agents.id))
        .where(and(...conditions))
        .groupBy(costEvents.agentId, agents.name, agents.status)
        .orderBy(desc(sql`coalesce(sum(${costEvents.costCents}), 0)::int`));
    },

    byProvider: async (companyId: string, range?: CostDateRange) => {
      const conditions: ReturnType<typeof eq>[] = [eq(costEvents.companyId, companyId)];
      if (range?.from) conditions.push(gte(costEvents.occurredAt, range.from));
      if (range?.to) conditions.push(lte(costEvents.occurredAt, range.to));

      return db
        .select({
          provider: costEvents.provider,
          biller: costEvents.biller,
          billingType: costEvents.billingType,
          model: costEvents.model,
          costCents: sql<number>`coalesce(sum(${costEvents.costCents}), 0)::int`,
          inputTokens: sql<number>`coalesce(sum(${costEvents.inputTokens}), 0)::int`,
          cachedInputTokens: sql<number>`coalesce(sum(${costEvents.cachedInputTokens}), 0)::int`,
          outputTokens: sql<number>`coalesce(sum(${costEvents.outputTokens}), 0)::int`,
          apiRunCount:
            sql<number>`count(distinct case when ${costEvents.billingType} = ${METERED_BILLING_TYPE} then ${costEvents.heartbeatRunId} end)::int`,
          subscriptionRunCount:
            sql<number>`count(distinct case when ${costEvents.billingType} in (${sql.join(SUBSCRIPTION_BILLING_TYPES.map((value) => sql`${value}`), sql`, `)}) then ${costEvents.heartbeatRunId} end)::int`,
          subscriptionCachedInputTokens:
            sql<number>`coalesce(sum(case when ${costEvents.billingType} in (${sql.join(SUBSCRIPTION_BILLING_TYPES.map((value) => sql`${value}`), sql`, `)}) then ${costEvents.cachedInputTokens} else 0 end), 0)::int`,
          subscriptionInputTokens:
            sql<number>`coalesce(sum(case when ${costEvents.billingType} in (${sql.join(SUBSCRIPTION_BILLING_TYPES.map((value) => sql`${value}`), sql`, `)}) then ${costEvents.inputTokens} else 0 end), 0)::int`,
          subscriptionOutputTokens:
            sql<number>`coalesce(sum(case when ${costEvents.billingType} in (${sql.join(SUBSCRIPTION_BILLING_TYPES.map((value) => sql`${value}`), sql`, `)}) then ${costEvents.outputTokens} else 0 end), 0)::int`,
        })
        .from(costEvents)
        .where(and(...conditions))
        .groupBy(costEvents.provider, costEvents.biller, costEvents.billingType, costEvents.model)
        .orderBy(desc(sql`coalesce(sum(${costEvents.costCents}), 0)::int`));
    },

    byBiller: async (companyId: string, range?: CostDateRange) => {
      const conditions: ReturnType<typeof eq>[] = [eq(costEvents.companyId, companyId)];
      if (range?.from) conditions.push(gte(costEvents.occurredAt, range.from));
      if (range?.to) conditions.push(lte(costEvents.occurredAt, range.to));

      return db
        .select({
          biller: costEvents.biller,
          costCents: sql<number>`coalesce(sum(${costEvents.costCents}), 0)::int`,
          inputTokens: sql<number>`coalesce(sum(${costEvents.inputTokens}), 0)::int`,
          cachedInputTokens: sql<number>`coalesce(sum(${costEvents.cachedInputTokens}), 0)::int`,
          outputTokens: sql<number>`coalesce(sum(${costEvents.outputTokens}), 0)::int`,
          apiRunCount:
            sql<number>`count(distinct case when ${costEvents.billingType} = ${METERED_BILLING_TYPE} then ${costEvents.heartbeatRunId} end)::int`,
          subscriptionRunCount:
            sql<number>`count(distinct case when ${costEvents.billingType} in (${sql.join(SUBSCRIPTION_BILLING_TYPES.map((value) => sql`${value}`), sql`, `)}) then ${costEvents.heartbeatRunId} end)::int`,
          subscriptionCachedInputTokens:
            sql<number>`coalesce(sum(case when ${costEvents.billingType} in (${sql.join(SUBSCRIPTION_BILLING_TYPES.map((value) => sql`${value}`), sql`, `)}) then ${costEvents.cachedInputTokens} else 0 end), 0)::int`,
          subscriptionInputTokens:
            sql<number>`coalesce(sum(case when ${costEvents.billingType} in (${sql.join(SUBSCRIPTION_BILLING_TYPES.map((value) => sql`${value}`), sql`, `)}) then ${costEvents.inputTokens} else 0 end), 0)::int`,
          subscriptionOutputTokens:
            sql<number>`coalesce(sum(case when ${costEvents.billingType} in (${sql.join(SUBSCRIPTION_BILLING_TYPES.map((value) => sql`${value}`), sql`, `)}) then ${costEvents.outputTokens} else 0 end), 0)::int`,
          providerCount: sql<number>`count(distinct ${costEvents.provider})::int`,
          modelCount: sql<number>`count(distinct ${costEvents.model})::int`,
        })
        .from(costEvents)
        .where(and(...conditions))
        .groupBy(costEvents.biller)
        .orderBy(desc(sql`coalesce(sum(${costEvents.costCents}), 0)::int`));
    },

    /**
     * aggregates cost_events by provider for each of three rolling windows:
     * last 5 hours, last 24 hours, last 7 days.
     * purely internal consumption data, no external rate-limit sources.
     */
    windowSpend: async (companyId: string) => {
      const windows = [
        { label: "5h", hours: 5 },
        { label: "24h", hours: 24 },
        { label: "7d", hours: 168 },
      ] as const;

      const results = await Promise.all(
        windows.map(async ({ label, hours }) => {
          const since = new Date(Date.now() - hours * 60 * 60 * 1000);
          const rows = await db
            .select({
              provider: costEvents.provider,
              biller: sql<string>`case when count(distinct ${costEvents.biller}) = 1 then min(${costEvents.biller}) else 'mixed' end`,
              costCents: sql<number>`coalesce(sum(${costEvents.costCents}), 0)::int`,
              inputTokens: sql<number>`coalesce(sum(${costEvents.inputTokens}), 0)::int`,
              cachedInputTokens: sql<number>`coalesce(sum(${costEvents.cachedInputTokens}), 0)::int`,
              outputTokens: sql<number>`coalesce(sum(${costEvents.outputTokens}), 0)::int`,
            })
            .from(costEvents)
            .where(
              and(
                eq(costEvents.companyId, companyId),
                gte(costEvents.occurredAt, since),
              ),
            )
            .groupBy(costEvents.provider)
            .orderBy(desc(sql`coalesce(sum(${costEvents.costCents}), 0)::int`));

          return rows.map((row) => ({
            provider: row.provider,
            biller: row.biller,
            window: label as string,
            windowHours: hours,
            costCents: row.costCents,
            inputTokens: row.inputTokens,
            cachedInputTokens: row.cachedInputTokens,
            outputTokens: row.outputTokens,
          }));
        }),
      );

      return results.flat();
    },

    byAgentModel: async (companyId: string, range?: CostDateRange) => {
      const conditions: ReturnType<typeof eq>[] = [eq(costEvents.companyId, companyId)];
      if (range?.from) conditions.push(gte(costEvents.occurredAt, range.from));
      if (range?.to) conditions.push(lte(costEvents.occurredAt, range.to));

      // single query: group by agent + provider + model.
      // the (companyId, agentId, occurredAt) composite index covers this well.
      // order by provider + model for stable db-level ordering; cost-desc sort
      // within each agent's sub-rows is done client-side in the ui memo.
      return db
        .select({
          agentId: costEvents.agentId,
          agentName: agents.name,
          provider: costEvents.provider,
          biller: costEvents.biller,
          billingType: costEvents.billingType,
          model: costEvents.model,
          costCents: sql<number>`coalesce(sum(${costEvents.costCents}), 0)::int`,
          inputTokens: sql<number>`coalesce(sum(${costEvents.inputTokens}), 0)::int`,
          cachedInputTokens: sql<number>`coalesce(sum(${costEvents.cachedInputTokens}), 0)::int`,
          outputTokens: sql<number>`coalesce(sum(${costEvents.outputTokens}), 0)::int`,
        })
        .from(costEvents)
        .leftJoin(agents, eq(costEvents.agentId, agents.id))
        .where(and(...conditions))
        .groupBy(
          costEvents.agentId,
          agents.name,
          costEvents.provider,
          costEvents.biller,
          costEvents.billingType,
          costEvents.model,
        )
        .orderBy(costEvents.provider, costEvents.biller, costEvents.billingType, costEvents.model);
    },

    byProject: async (companyId: string, range?: CostDateRange) => {
      const issueIdAsText = sql<string>`${issues.id}::text`;
      const runProjectLinks = db
        .selectDistinctOn([activityLog.runId, issues.projectId], {
          runId: activityLog.runId,
          projectId: issues.projectId,
        })
        .from(activityLog)
        .innerJoin(
          issues,
          and(
            eq(activityLog.entityType, "issue"),
            eq(activityLog.entityId, issueIdAsText),
          ),
        )
        .where(
          and(
            eq(activityLog.companyId, companyId),
            eq(issues.companyId, companyId),
            isNotNull(activityLog.runId),
            isNotNull(issues.projectId),
          ),
        )
        .orderBy(activityLog.runId, issues.projectId, desc(activityLog.createdAt))
        .as("run_project_links");

      const effectiveProjectId = sql<string | null>`coalesce(${costEvents.projectId}, ${runProjectLinks.projectId})`;
      const conditions: ReturnType<typeof eq>[] = [eq(costEvents.companyId, companyId)];
      if (range?.from) conditions.push(gte(costEvents.occurredAt, range.from));
      if (range?.to) conditions.push(lte(costEvents.occurredAt, range.to));

      const costCentsExpr = sql<number>`coalesce(sum(${costEvents.costCents}), 0)::int`;

      return db
        .select({
          projectId: effectiveProjectId,
          projectName: projects.name,
          costCents: costCentsExpr,
          inputTokens: sql<number>`coalesce(sum(${costEvents.inputTokens}), 0)::int`,
          cachedInputTokens: sql<number>`coalesce(sum(${costEvents.cachedInputTokens}), 0)::int`,
          outputTokens: sql<number>`coalesce(sum(${costEvents.outputTokens}), 0)::int`,
        })
        .from(costEvents)
        .leftJoin(runProjectLinks, eq(costEvents.heartbeatRunId, runProjectLinks.runId))
        .innerJoin(projects, sql`${projects.id} = ${effectiveProjectId}`)
        .where(and(...conditions, sql`${effectiveProjectId} is not null`))
        .groupBy(effectiveProjectId, projects.name)
        .orderBy(desc(costCentsExpr));
    },

    byUser: async (companyId: string, range?: CostDateRange) => {
      const conditions: ReturnType<typeof eq>[] = [eq(providerRequestLogs.companyId, companyId)];
      if (range?.from) conditions.push(gte(providerRequestLogs.requestStartedAt, range.from));
      if (range?.to) conditions.push(lte(providerRequestLogs.requestStartedAt, range.to));

      return db
        .select({
          userId: providerRequestLogs.userId,
          userName: authUsers.name,
          userEmail: authUsers.email,
          providerKeyId: providerRequestLogs.providerKeyId,
          providerKeyName: companyProviderKeys.name,
          provider: sql<string | null>`coalesce(${companyProviderKeys.provider}, ${providerRequestLogs.provider})`,
          costCents: sql<number>`coalesce(sum(coalesce(${providerRequestLogs.costCents}, 0)), 0)::int`,
          inputTokens: sql<number>`coalesce(sum(${providerRequestLogs.inputTokens}), 0)::int`,
          cachedInputTokens: sql<number>`coalesce(sum(${providerRequestLogs.cachedInputTokens}), 0)::int`,
          outputTokens: sql<number>`coalesce(sum(${providerRequestLogs.outputTokens}), 0)::int`,
          requestCount: sql<number>`count(*)::int`,
          lastOccurredAt: sql<Date | null>`max(${providerRequestLogs.requestStartedAt})`,
        })
        .from(providerRequestLogs)
        .leftJoin(authUsers, eq(providerRequestLogs.userId, authUsers.id))
        .leftJoin(companyProviderKeys, eq(providerRequestLogs.providerKeyId, companyProviderKeys.id))
        .where(and(...conditions, isNotNull(providerRequestLogs.userId)))
        .groupBy(
          providerRequestLogs.userId,
          authUsers.name,
          authUsers.email,
          providerRequestLogs.providerKeyId,
          companyProviderKeys.name,
          companyProviderKeys.provider,
          providerRequestLogs.provider,
        )
        .orderBy(desc(sql`coalesce(sum(coalesce(${providerRequestLogs.costCents}, 0)), 0)::int`));
    },

    listProviderRequestLogs: async (
      companyId: string,
      options: {
        from?: Date;
        to?: Date;
        userId?: string;
        providerKeyId?: string;
        limit?: number;
      } = {},
    ) => {
      const conditions: ReturnType<typeof eq>[] = [eq(providerRequestLogs.companyId, companyId)];
      if (options.from) conditions.push(gte(providerRequestLogs.requestStartedAt, options.from));
      if (options.to) conditions.push(lte(providerRequestLogs.requestStartedAt, options.to));
      if (options.userId) conditions.push(eq(providerRequestLogs.userId, options.userId));
      if (options.providerKeyId) conditions.push(eq(providerRequestLogs.providerKeyId, options.providerKeyId));

      return db
        .select({
          id: providerRequestLogs.id,
          companyId: providerRequestLogs.companyId,
          userId: providerRequestLogs.userId,
          userName: authUsers.name,
          userEmail: authUsers.email,
          providerKeyId: providerRequestLogs.providerKeyId,
          providerKeyName: companyProviderKeys.name,
          agentId: providerRequestLogs.agentId,
          costEventId: providerRequestLogs.costEventId,
          externalRequestId: providerRequestLogs.externalRequestId,
          provider: providerRequestLogs.provider,
          model: providerRequestLogs.model,
          requestMethod: providerRequestLogs.requestMethod,
          requestPath: providerRequestLogs.requestPath,
          status: providerRequestLogs.status,
          httpStatus: providerRequestLogs.httpStatus,
          inputTokens: providerRequestLogs.inputTokens,
          cachedInputTokens: providerRequestLogs.cachedInputTokens,
          outputTokens: providerRequestLogs.outputTokens,
          costCents: providerRequestLogs.costCents,
          requestStartedAt: providerRequestLogs.requestStartedAt,
          requestCompletedAt: providerRequestLogs.requestCompletedAt,
          metadataJson: providerRequestLogs.metadataJson,
          createdAt: providerRequestLogs.createdAt,
          updatedAt: providerRequestLogs.updatedAt,
        })
        .from(providerRequestLogs)
        .leftJoin(authUsers, eq(providerRequestLogs.userId, authUsers.id))
        .leftJoin(companyProviderKeys, eq(providerRequestLogs.providerKeyId, companyProviderKeys.id))
        .where(and(...conditions))
        .orderBy(desc(providerRequestLogs.requestStartedAt))
        .limit(options.limit ?? 100);
    },
  };
}
