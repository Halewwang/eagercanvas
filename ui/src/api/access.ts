import type { AgentAdapterType, JoinRequest } from "@paperclipai/shared";
import { api } from "./client";

type InviteSummary = {
  id: string;
  companyId: string | null;
  inviteType: "company_join" | "bootstrap_ceo";
  allowedJoinTypes: "human" | "agent" | "both";
  expiresAt: string;
  onboardingPath?: string;
  onboardingUrl?: string;
  onboardingTextPath?: string;
  onboardingTextUrl?: string;
  skillIndexPath?: string;
  skillIndexUrl?: string;
  inviteMessage?: string | null;
};

type AcceptInviteInput =
  | { requestType: "human" }
  | {
    requestType: "agent";
    agentName: string;
    adapterType?: AgentAdapterType;
    capabilities?: string | null;
    agentDefaultsPayload?: Record<string, unknown> | null;
  };

type AgentJoinRequestAccepted = JoinRequest & {
  claimSecret: string;
  claimApiKeyPath: string;
  onboarding?: Record<string, unknown>;
  diagnostics?: Array<{
    code: string;
    level: "info" | "warn";
    message: string;
    hint?: string;
  }>;
};

type InviteOnboardingManifest = {
  invite: InviteSummary;
  onboarding: {
    inviteMessage?: string | null;
    connectivity?: {
      guidance?: string;
      connectionCandidates?: string[];
      testResolutionEndpoint?: {
        method?: string;
        path?: string;
        url?: string;
      };
    };
    textInstructions?: {
      url?: string;
    };
  };
};

type BoardClaimStatus = {
  status: "available" | "claimed" | "expired";
  requiresSignIn: boolean;
  expiresAt: string | null;
  claimedByUserId: string | null;
};

type CompanyInviteCreated = {
  id: string;
  token: string;
  inviteUrl: string;
  expiresAt: string;
  allowedJoinTypes: "human" | "agent" | "both";
  onboardingTextPath?: string;
  onboardingTextUrl?: string;
  inviteMessage?: string | null;
};

export type CompanyMemberSummary = {
  id: string;
  companyId: string;
  principalType: "user" | "agent";
  principalId: string;
  status: "pending" | "active" | "suspended";
  membershipRole: string | null;
  createdAt: string;
  updatedAt: string;
  userName?: string | null;
  userEmail?: string | null;
};

export type CompanyProviderKey = {
  id: string;
  companyId: string;
  provider: string;
  name: string;
  externalKeyId: string | null;
  secretId: string;
  secretVersion: number | null;
  status: "active" | "disabled" | "revoked";
  allowSaveLogs: boolean;
  allowManageKey: boolean;
  limitCostCents: number | null;
  limitDailyCostCents: number | null;
  expiresAt: string | null;
  lastSyncedAt: string | null;
  metadataJson: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
};

export type UserProviderKeyAssignmentSummary = {
  assignmentId: string;
  companyId: string;
  userId: string;
  userName: string | null;
  userEmail: string | null;
  providerKeyId: string;
  provider: string;
  providerKeyName: string;
  assignmentMode: "exclusive" | "shared";
  assignedByUserId: string | null;
  assignedAt: string;
  revokedAt: string | null;
};

export const accessApi = {
  createCompanyInvite: (
    companyId: string,
    input: {
      allowedJoinTypes?: "human" | "agent" | "both";
      defaultsPayload?: Record<string, unknown> | null;
      agentMessage?: string | null;
    } = {},
  ) =>
    api.post<CompanyInviteCreated>(`/companies/${companyId}/invites`, input),

  createOpenClawInvitePrompt: (
    companyId: string,
    input: {
      agentMessage?: string | null;
    } = {},
  ) =>
    api.post<CompanyInviteCreated>(
      `/companies/${companyId}/openclaw/invite-prompt`,
      input,
    ),

  getInvite: (token: string) => api.get<InviteSummary>(`/invites/${token}`),
  getInviteOnboarding: (token: string) =>
    api.get<InviteOnboardingManifest>(`/invites/${token}/onboarding`),

  acceptInvite: (token: string, input: AcceptInviteInput) =>
    api.post<AgentJoinRequestAccepted | JoinRequest | { bootstrapAccepted: true; userId: string }>(
      `/invites/${token}/accept`,
      input,
    ),

  listJoinRequests: (companyId: string, status: "pending_approval" | "approved" | "rejected" = "pending_approval") =>
    api.get<JoinRequest[]>(`/companies/${companyId}/join-requests?status=${status}`),

  approveJoinRequest: (companyId: string, requestId: string) =>
    api.post<JoinRequest>(`/companies/${companyId}/join-requests/${requestId}/approve`, {}),

  rejectJoinRequest: (companyId: string, requestId: string) =>
    api.post<JoinRequest>(`/companies/${companyId}/join-requests/${requestId}/reject`, {}),

  listMembers: (companyId: string) =>
    api.get<CompanyMemberSummary[]>(`/companies/${companyId}/members`),

  listProviderKeys: (companyId: string) =>
    api.get<CompanyProviderKey[]>(`/companies/${companyId}/provider-keys`),

  createProviderKey: (
    companyId: string,
    input: {
      provider: string;
      name: string;
      secretId: string;
      secretVersion?: number | null;
      externalKeyId?: string | null;
      allowSaveLogs?: boolean;
      allowManageKey?: boolean;
      limitCostCents?: number | null;
      limitDailyCostCents?: number | null;
      expiresAt?: string | null;
      metadataJson?: Record<string, unknown> | null;
    },
  ) => api.post<CompanyProviderKey>(`/companies/${companyId}/provider-keys`, input),

  updateProviderKey: (
    companyId: string,
    keyId: string,
    input: Partial<{
      provider: string;
      name: string;
      secretId: string;
      secretVersion: number | null;
      externalKeyId: string | null;
      status: "active" | "disabled" | "revoked";
      allowSaveLogs: boolean;
      allowManageKey: boolean;
      limitCostCents: number | null;
      limitDailyCostCents: number | null;
      expiresAt: string | null;
      metadataJson: Record<string, unknown> | null;
    }>,
  ) => api.patch<CompanyProviderKey>(`/companies/${companyId}/provider-keys/${encodeURIComponent(keyId)}`, input),

  revokeProviderKey: (companyId: string, keyId: string) =>
    api.post<CompanyProviderKey>(`/companies/${companyId}/provider-keys/${encodeURIComponent(keyId)}/revoke`, {}),

  listUserKeyAssignments: (companyId: string) =>
    api.get<UserProviderKeyAssignmentSummary[]>(`/companies/${companyId}/user-key-assignments`),

  assignUserProviderKey: (
    companyId: string,
    userId: string,
    input: {
      providerKeyId: string;
      assignmentMode?: "exclusive" | "shared";
    },
  ) =>
    api.put<UserProviderKeyAssignmentSummary>(
      `/companies/${companyId}/users/${encodeURIComponent(userId)}/provider-key-assignment`,
      input,
    ),

  revokeUserProviderKeyAssignment: (companyId: string, userId: string) =>
    api.delete<{ ok: true }>(`/companies/${companyId}/users/${encodeURIComponent(userId)}/provider-key-assignment`),

  claimJoinRequestApiKey: (requestId: string, claimSecret: string) =>
    api.post<{ keyId: string; token: string; agentId: string; createdAt: string }>(
      `/join-requests/${requestId}/claim-api-key`,
      { claimSecret },
    ),

  getBoardClaimStatus: (token: string, code: string) =>
    api.get<BoardClaimStatus>(`/board-claim/${token}?code=${encodeURIComponent(code)}`),

  claimBoard: (token: string, code: string) =>
    api.post<{ claimed: true; userId: string }>(`/board-claim/${token}/claim`, { code }),
};
