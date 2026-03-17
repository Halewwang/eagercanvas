export interface CompanyProviderKey {
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
  expiresAt: Date | null;
  lastSyncedAt: Date | null;
  metadataJson: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserProviderKeyAssignment {
  id: string;
  companyId: string;
  userId: string;
  providerKeyId: string;
  assignmentMode: "exclusive" | "shared";
  assignedByUserId: string | null;
  assignedAt: Date;
  revokedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserProviderKeyAssignmentSummary {
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
  assignedAt: Date;
  revokedAt: Date | null;
}

export interface ProviderLogSyncResult {
  providerKeyId: string;
  provider: string;
  fetchedCount: number;
  upsertedCount: number;
  matchedExistingCount: number;
  inferredUserCount: number;
  unmappedCount: number;
  skippedCount: number;
  syncedAt: Date;
}
