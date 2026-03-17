import express from "express";
import request from "supertest";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { providerProxyRoutes } from "../routes/provider-proxy.js";
import { errorHandler } from "../middleware/index.js";

const mockProviderKeyService = vi.hoisted(() => ({
  getActiveAssignmentForUser: vi.fn(),
  getProviderKey: vi.fn(),
  findAssignmentForProviderKeyAtTime: vi.fn(),
  markProviderKeySynced: vi.fn(),
}));

const mockSecretService = vi.hoisted(() => ({
  resolveSecretValue: vi.fn(),
}));

const mockCostService = vi.hoisted(() => ({
  createProviderRequestLog: vi.fn(),
  upsertProviderRequestLog: vi.fn(),
}));

const mockLogActivity = vi.hoisted(() => vi.fn());

vi.mock("../services/index.js", () => ({
  providerKeyService: () => mockProviderKeyService,
  secretService: () => mockSecretService,
  costService: () => mockCostService,
  logActivity: mockLogActivity,
}));

function createApp() {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.actor = {
      type: "board",
      userId: "board-user",
      source: "session",
      isInstanceAdmin: false,
      companyIds: ["company-1"],
    };
    next();
  });
  app.use("/api", providerProxyRoutes({} as never));
  app.use(errorHandler);
  return app;
}

function mockResponse(input: {
  ok: boolean;
  status: number;
  headers?: Record<string, string>;
  text?: string;
  json?: unknown;
}) {
  return {
    ok: input.ok,
    status: input.status,
    headers: {
      get: (name: string) => input.headers?.[name.toLowerCase()] ?? input.headers?.[name] ?? null,
    },
    text: vi.fn().mockResolvedValue(input.text ?? ""),
    json: vi.fn().mockResolvedValue(input.json ?? null),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", vi.fn());
  mockSecretService.resolveSecretValue.mockResolvedValue("302-secret");
  mockLogActivity.mockResolvedValue(undefined);
  mockProviderKeyService.markProviderKeySynced.mockResolvedValue(undefined);
});

describe("provider proxy routes", () => {
  it("proxies 302 chat completions and records a provider request log", async () => {
    mockProviderKeyService.getActiveAssignmentForUser.mockResolvedValue({
      assignmentId: "assignment-1",
      providerKeyId: "provider-key-1",
      secretId: "secret-1",
      secretVersion: 1,
    });
    mockCostService.createProviderRequestLog.mockResolvedValue({ id: "log-1" });

    vi.mocked(fetch)
      .mockResolvedValueOnce(
        mockResponse({
          ok: true,
          status: 200,
          headers: {
            "content-type": "application/json",
            "request-id": "req-302-1",
          },
          text: JSON.stringify({
            id: "chatcmpl-1",
            usage: {
              prompt_tokens: 11,
              completion_tokens: 7,
              prompt_tokens_details: { cached_tokens: 3 },
            },
          }),
        }) as never,
      )
      .mockResolvedValueOnce(
        mockResponse({
          ok: true,
          status: 200,
          json: {
            model: "gpt-4.1-mini",
            cost: "0.12",
            input_token: 11,
            output_token: 7,
          },
        }) as never,
      );

    const app = createApp();
    const res = await request(app)
      .post("/api/companies/company-1/302ai/chat/completions")
      .send({
        targetUserId: "user-1",
        payload: {
          model: "gpt-4.1-mini",
          messages: [{ role: "user", content: "ping" }],
        },
      });

    expect(res.status).toBe(200);
    expect(res.headers["x-paperclip-request-id"]).toBe("req-302-1");
    expect(mockCostService.createProviderRequestLog).toHaveBeenCalledWith(
      "company-1",
      expect.objectContaining({
        userId: "user-1",
        providerKeyId: "provider-key-1",
        externalRequestId: "req-302-1",
        provider: "302ai",
        model: "gpt-4.1-mini",
        costCents: 12,
      }),
    );
  });

  it("syncs 302 api-record pages into the local provider request log ledger", async () => {
    mockProviderKeyService.getProviderKey.mockResolvedValue({
      id: "provider-key-1",
      provider: "302ai",
      secretId: "secret-1",
      secretVersion: 1,
    });
    mockProviderKeyService.findAssignmentForProviderKeyAtTime.mockResolvedValue({
      assignmentId: "assignment-1",
      userId: "user-1",
      userName: "Test User",
      userEmail: "user@example.com",
    });
    mockCostService.upsertProviderRequestLog.mockResolvedValue({
      log: { id: "log-1" },
      matchedExisting: false,
    });

    vi.mocked(fetch)
      .mockResolvedValueOnce(
        mockResponse({
          ok: true,
          status: 200,
          json: {
            items: [
              {
                request_id: "req-sync-1",
                model: "gpt-4.1-mini",
                created_at: "2026-03-16T12:00:00.000Z",
                status: "completed",
              },
            ],
            pagination: { page: 1, limit: 100, total: 1 },
          },
        }) as never,
      )
      .mockResolvedValueOnce(
        mockResponse({
          ok: true,
          status: 200,
          json: {
            model: "gpt-4.1-mini",
            cost: "0.08",
            input_token: 9,
            output_token: 4,
          },
        }) as never,
      );

    const app = createApp();
    const res = await request(app)
      .post("/api/companies/company-1/provider-keys/provider-key-1/302ai/sync-logs")
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.providerKeyId).toBe("provider-key-1");
    expect(res.body.fetchedCount).toBe(1);
    expect(res.body.upsertedCount).toBe(1);
    expect(res.body.inferredUserCount).toBe(1);
    expect(mockCostService.upsertProviderRequestLog).toHaveBeenCalledWith(
      "company-1",
      expect.objectContaining({
        externalRequestId: "req-sync-1",
        providerKeyId: "provider-key-1",
        userId: "user-1",
        costCents: 8,
      }),
    );
    expect(mockProviderKeyService.markProviderKeySynced).toHaveBeenCalledWith(
      "company-1",
      "provider-key-1",
      expect.any(Date),
    );
  });
});
