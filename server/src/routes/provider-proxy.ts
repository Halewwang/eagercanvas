import { Router } from "express";
import { randomUUID } from "node:crypto";
import { syncProviderKeyLogsSchema } from "@paperclipai/shared";
import type { Db } from "@paperclipai/db";
import { z } from "zod";
import { badRequest, forbidden, notFound, unprocessable } from "../errors.js";
import { assertCompanyAccess, getActorInfo } from "./authz.js";
import { costService, logActivity, providerKeyService, secretService } from "../services/index.js";

const proxyChatCompletionSchema = z.object({
  targetUserId: z.string().min(1).optional(),
  payload: z.object({
    model: z.string().min(1),
  }).passthrough(),
});

const OPENAI_COMPAT_BASE_URL = "https://api.302.ai/v1";
const DASHBOARD_BASE_URL = "https://api.302.ai/dashboard";

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function normalizeTokenCount(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return Math.floor(value);
  }
  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed) && parsed >= 0) return parsed;
  }
  return 0;
}

function normalizeCostCents(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
    return Math.round(value * 100);
  }
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed) && parsed >= 0) {
      return Math.round(parsed * 100);
    }
  }
  return null;
}

function pickString(source: Record<string, unknown> | null, keys: string[]): string | null {
  if (!source) return null;
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return null;
}

function pickNumber(source: Record<string, unknown> | null, keys: string[]): number | null {
  if (!source) return null;
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim().length > 0) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

function pickDate(source: Record<string, unknown> | null, keys: string[]): Date | null {
  const raw = pickString(source, keys);
  if (!raw) return null;
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

async function fetch302Record(apiKey: string, requestId: string) {
  const response = await fetch(`${DASHBOARD_BASE_URL}/record/${encodeURIComponent(requestId)}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    return null;
  }

  const payload = await response.json().catch(() => null);
  return asRecord(payload);
}

async function fetch302ApiRecordPage(
  apiKey: string,
  options: { startTime?: Date; endTime?: Date; page: number; pageSize: number },
) {
  const params = new URLSearchParams();
  params.set("page", String(options.page));
  params.set("limit", String(options.pageSize));
  if (options.startTime) params.set("start_time", options.startTime.toISOString());
  if (options.endTime) params.set("end_time", options.endTime.toISOString());

  const response = await fetch(`${DASHBOARD_BASE_URL}/api-record?${params.toString()}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw unprocessable(`302 API-Record sync failed (${response.status}): ${body || "unknown error"}`);
  }

  const payload = await response.json().catch(() => null);
  const root = asRecord(payload);
  const envelope = asRecord(root?.data) ?? root;
  const items = asArray(envelope?.items ?? root?.items);
  const pagination = asRecord(envelope?.pagination ?? root?.pagination);
  const total = pickNumber(pagination, ["total", "count"]);
  const page = pickNumber(pagination, ["page", "current_page"]) ?? options.page;
  const pageSize = pickNumber(pagination, ["limit", "page_size", "per_page"]) ?? options.pageSize;
  const hasMore =
    typeof total === "number"
      ? page * pageSize < total
      : items.length === options.pageSize;

  return {
    items,
    hasMore,
    raw: root,
  };
}

function parseApiRecordItem(item: unknown, fallback: { providerKeyId: string; inferredUserId: string | null }) {
  const record = asRecord(item);
  const requestId = pickString(record, ["request_id", "requestId", "id"]);
  if (!requestId) return null;

  return {
    externalRequestId: requestId,
    model: pickString(record, ["model", "api_name", "apiName"]) ?? "unknown",
    requestMethod: pickString(record, ["method", "request_method"]) ?? "POST",
    requestPath: pickString(record, ["path", "request_path", "url_path"]) ?? "/v1/chat/completions",
    status: pickString(record, ["status", "request_status"]) ?? "completed",
    httpStatus: pickNumber(record, ["http_status", "status_code", "statusCode"]),
    inputTokens: normalizeTokenCount(
      pickNumber(record, ["input_token", "input_tokens", "prompt_tokens"]),
    ),
    cachedInputTokens: normalizeTokenCount(
      pickNumber(record, ["cached_input_token", "cached_input_tokens", "cached_tokens"]),
    ),
    outputTokens: normalizeTokenCount(
      pickNumber(record, ["output_token", "output_tokens", "completion_tokens"]),
    ),
    costCents: normalizeCostCents(
      pickNumber(record, ["cost", "cost_usd"]) ?? pickString(record, ["cost", "cost_usd"]),
    ),
    requestStartedAt:
      pickDate(record, ["created_at", "request_started_at", "start_time", "createdAt"]) ?? new Date(),
    requestCompletedAt:
      pickDate(record, ["completed_at", "request_completed_at", "end_time", "updated_at", "updatedAt"]),
    metadataJson: {
      source: "302_api_record_sync",
      raw: record,
      inferredUserId: fallback.inferredUserId,
    },
    userId: fallback.inferredUserId,
    providerKeyId: fallback.providerKeyId,
    provider: "302ai",
  };
}

export function providerProxyRoutes(db: Db) {
  const router = Router();
  const providerKeys = providerKeyService(db);
  const secrets = secretService(db);
  const costs = costService(db);

  router.post("/companies/:companyId/302ai/chat/completions", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);

    if (req.actor.type !== "board") {
      throw forbidden("Authenticated user session required");
    }

    const parsed = proxyChatCompletionSchema.safeParse(req.body);
    if (!parsed.success) {
      throw badRequest("Invalid 302 proxy request", parsed.error.flatten());
    }

    const targetUserId = parsed.data.targetUserId ?? req.actor.userId ?? null;
    if (!targetUserId) {
      throw badRequest("targetUserId is required when the session has no user id");
    }
    if (parsed.data.payload.stream === true) {
      throw badRequest("Streaming is not supported on the admin 302 proxy route yet");
    }

    const assignment = await providerKeys.getActiveAssignmentForUser(companyId, targetUserId, "302ai");
    if (!assignment) {
      res.status(404).json({ error: "No active 302 provider key assignment found for user" });
      return;
    }

    const apiKey = await secrets.resolveSecretValue(
      companyId,
      assignment.secretId,
      assignment.secretVersion ?? "latest",
    );

    const requestId = randomUUID();
    const startedAt = new Date();
    const upstreamResponse = await fetch(`${OPENAI_COMPAT_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "request-id": requestId,
      },
      body: JSON.stringify(parsed.data.payload),
    });

    const responseBody = await upstreamResponse.text();
    let parsedResponse: Record<string, unknown> | null = null;
    try {
      parsedResponse = JSON.parse(responseBody) as Record<string, unknown>;
    } catch {
      parsedResponse = null;
    }

    const resolvedRequestId = upstreamResponse.headers.get("request-id") ?? requestId;
    const usage = asRecord(parsedResponse?.usage);
    const usageDetails = asRecord(usage?.prompt_tokens_details);
    const usageInputTokens = normalizeTokenCount(usage?.prompt_tokens);
    const usageCachedInputTokens = normalizeTokenCount(usageDetails?.cached_tokens);
    const usageOutputTokens = normalizeTokenCount(usage?.completion_tokens);

    const recordPayload = upstreamResponse.ok ? await fetch302Record(apiKey, resolvedRequestId) : null;
    const recordInputTokens = normalizeTokenCount(recordPayload?.input_token);
    const recordOutputTokens = normalizeTokenCount(recordPayload?.output_token);
    const model = pickString(recordPayload, ["model"]) ?? parsed.data.payload.model;
    const costCents = normalizeCostCents(recordPayload?.cost);
    const completedAt = new Date();

    const providerRequestLog = await costs.createProviderRequestLog(companyId, {
      userId: targetUserId,
      providerKeyId: assignment.providerKeyId,
      externalRequestId: resolvedRequestId,
      provider: "302ai",
      model,
      requestMethod: "POST",
      requestPath: "/v1/chat/completions",
      status: upstreamResponse.ok ? "completed" : "error",
      httpStatus: upstreamResponse.status,
      inputTokens: recordInputTokens || usageInputTokens,
      cachedInputTokens: usageCachedInputTokens,
      outputTokens: recordOutputTokens || usageOutputTokens,
      costCents,
      requestStartedAt: startedAt,
      requestCompletedAt: completedAt,
      metadataJson: {
        assignmentId: assignment.assignmentId,
        upstreamOk: upstreamResponse.ok,
        providerRecord: recordPayload,
      },
    });

    const actor = getActorInfo(req);
    await logActivity(db, {
      companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      action: "provider_proxy.302ai_chat_completion",
      entityType: "provider_request_log",
      entityId: providerRequestLog.id,
      details: {
        targetUserId,
        providerKeyId: assignment.providerKeyId,
        externalRequestId: resolvedRequestId,
        model,
        upstreamStatus: upstreamResponse.status,
      },
    });

    res.status(upstreamResponse.status);
    const contentType = upstreamResponse.headers.get("content-type");
    if (contentType) {
      res.setHeader("content-type", contentType);
    }
    res.setHeader("x-paperclip-request-id", resolvedRequestId);
    res.send(responseBody);
  });

  router.post("/companies/:companyId/provider-keys/:keyId/302ai/sync-logs", async (req, res) => {
    const companyId = req.params.companyId as string;
    const keyId = req.params.keyId as string;
    assertCompanyAccess(req, companyId);

    if (req.actor.type !== "board") {
      throw forbidden("Authenticated user session required");
    }

    const parsed = syncProviderKeyLogsSchema.safeParse(req.body ?? {});
    if (!parsed.success) {
      throw badRequest("Invalid 302 sync request", parsed.error.flatten());
    }

    const providerKey = await providerKeys.getProviderKey(companyId, keyId);
    if (!providerKey) throw notFound("Provider key not found");
    if (providerKey.provider !== "302ai") {
      throw unprocessable("Log sync is only implemented for 302ai keys");
    }

    const apiKey = await secrets.resolveSecretValue(
      companyId,
      providerKey.secretId,
      providerKey.secretVersion ?? "latest",
    );

    const startTime = parsed.data.startTime ? new Date(parsed.data.startTime) : new Date(Date.now() - 24 * 60 * 60 * 1000);
    const endTime = parsed.data.endTime ? new Date(parsed.data.endTime) : new Date();
    if (Number.isNaN(startTime.getTime()) || Number.isNaN(endTime.getTime()) || startTime > endTime) {
      throw badRequest("Invalid sync time window");
    }

    let fetchedCount = 0;
    let upsertedCount = 0;
    let matchedExistingCount = 0;
    let inferredUserCount = 0;
    let unmappedCount = 0;
    let skippedCount = 0;

    for (let page = 1; page <= parsed.data.maxPages; page += 1) {
      const pageResult = await fetch302ApiRecordPage(apiKey, {
        startTime,
        endTime,
        page,
        pageSize: parsed.data.pageSize,
      });

      fetchedCount += pageResult.items.length;

      for (const item of pageResult.items) {
        const seedRecord = asRecord(item);
        const inferredAt =
          pickDate(seedRecord, ["created_at", "request_started_at", "start_time", "createdAt"]) ?? new Date();
        const inferredAssignment = await providerKeys.findAssignmentForProviderKeyAtTime(
          companyId,
          providerKey.id,
          inferredAt,
        );

        const parsedLog = parseApiRecordItem(item, {
          providerKeyId: providerKey.id,
          inferredUserId: inferredAssignment?.userId ?? null,
        });
        if (!parsedLog) {
          skippedCount += 1;
          continue;
        }

        const recordPayload = await fetch302Record(apiKey, parsedLog.externalRequestId);
        const finalLog = {
          ...parsedLog,
          model: pickString(recordPayload, ["model"]) ?? parsedLog.model,
          inputTokens: normalizeTokenCount(recordPayload?.input_token) || parsedLog.inputTokens,
          outputTokens: normalizeTokenCount(recordPayload?.output_token) || parsedLog.outputTokens,
          costCents: normalizeCostCents(recordPayload?.cost) ?? parsedLog.costCents,
          metadataJson: {
            ...(parsedLog.metadataJson ?? {}),
            providerRecord: recordPayload,
          },
        };

        const upserted = await costs.upsertProviderRequestLog(companyId, finalLog);
        upsertedCount += 1;
        if (upserted.matchedExisting) {
          matchedExistingCount += 1;
        }
        if (finalLog.userId) {
          inferredUserCount += 1;
        } else {
          unmappedCount += 1;
        }
      }

      if (!pageResult.hasMore) break;
    }

    const syncedAt = new Date();
    await providerKeys.markProviderKeySynced(companyId, providerKey.id, syncedAt);

    const actor = getActorInfo(req);
    await logActivity(db, {
      companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      action: "provider_proxy.302ai_log_sync",
      entityType: "company_provider_key",
      entityId: providerKey.id,
      details: {
        provider: "302ai",
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        fetchedCount,
        upsertedCount,
        matchedExistingCount,
        inferredUserCount,
        unmappedCount,
        skippedCount,
      },
    });

    res.json({
      providerKeyId: providerKey.id,
      provider: providerKey.provider,
      fetchedCount,
      upsertedCount,
      matchedExistingCount,
      inferredUserCount,
      unmappedCount,
      skippedCount,
      syncedAt,
    });
  });

  return router;
}
