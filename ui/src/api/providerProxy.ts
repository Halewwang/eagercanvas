import type { ProviderLogSyncResult } from "@paperclipai/shared";
import { api } from "./client";

export const providerProxyApi = {
  chatCompletion: (
    companyId: string,
    input: {
      targetUserId?: string;
      payload: {
        model: string;
        messages: Array<{ role: string; content: string }>;
        temperature?: number;
      };
    },
  ) => api.post<Record<string, unknown>>(`/companies/${companyId}/302ai/chat/completions`, input),

  syncLogs: (
    companyId: string,
    providerKeyId: string,
    input: {
      startTime?: string;
      endTime?: string;
      pageSize?: number;
      maxPages?: number;
    } = {},
  ) =>
    api.post<ProviderLogSyncResult>(
      `/companies/${companyId}/provider-keys/${encodeURIComponent(providerKeyId)}/302ai/sync-logs`,
      input,
    ),
};
