import { and, desc, eq, gt, isNull, lte, or } from "drizzle-orm";
import type { Db } from "@paperclipai/db";
import {
  authUsers,
  companyMemberships,
  companyProviderKeys,
  companySecrets,
  userProviderKeyAssignments,
} from "@paperclipai/db";
import { conflict, notFound, unprocessable } from "../errors.js";

export function providerKeyService(db: Db) {
  async function assertSecretScope(companyId: string, secretId: string) {
    const secret = await db
      .select({ id: companySecrets.id, companyId: companySecrets.companyId })
      .from(companySecrets)
      .where(eq(companySecrets.id, secretId))
      .then((rows) => rows[0] ?? null);
    if (!secret) throw notFound("Secret not found");
    if (secret.companyId !== companyId) {
      throw unprocessable("Secret does not belong to company");
    }
  }

  async function getProviderKey(companyId: string, keyId: string) {
    return db
      .select()
      .from(companyProviderKeys)
      .where(and(eq(companyProviderKeys.companyId, companyId), eq(companyProviderKeys.id, keyId)))
      .then((rows) => rows[0] ?? null);
  }

  return {
    getProviderKey,

    listProviderKeys: async (companyId: string) =>
      db
        .select()
        .from(companyProviderKeys)
        .where(eq(companyProviderKeys.companyId, companyId))
        .orderBy(desc(companyProviderKeys.createdAt)),

    createProviderKey: async (
      companyId: string,
      data: Omit<typeof companyProviderKeys.$inferInsert, "companyId" | "createdAt" | "updatedAt">,
    ) => {
      await assertSecretScope(companyId, data.secretId);
      return db
        .insert(companyProviderKeys)
        .values({
          ...data,
          companyId,
          updatedAt: new Date(),
        })
        .returning()
        .then((rows) => rows[0]);
    },

    updateProviderKey: async (
      companyId: string,
      keyId: string,
      data: Partial<Omit<typeof companyProviderKeys.$inferInsert, "id" | "companyId" | "createdAt">>,
    ) => {
      const existing = await getProviderKey(companyId, keyId);
      if (!existing) return null;
      if (data.secretId) await assertSecretScope(companyId, data.secretId);
      return db
        .update(companyProviderKeys)
        .set({
          ...data,
          updatedAt: new Date(),
        })
        .where(eq(companyProviderKeys.id, keyId))
        .returning()
        .then((rows) => rows[0] ?? null);
    },

    markProviderKeySynced: async (companyId: string, keyId: string, syncedAt = new Date()) => {
      const existing = await getProviderKey(companyId, keyId);
      if (!existing) return null;
      return db
        .update(companyProviderKeys)
        .set({
          lastSyncedAt: syncedAt,
          updatedAt: syncedAt,
        })
        .where(eq(companyProviderKeys.id, keyId))
        .returning()
        .then((rows) => rows[0] ?? null);
    },

    revokeProviderKey: async (companyId: string, keyId: string) => {
      const existing = await getProviderKey(companyId, keyId);
      if (!existing) return null;

      const now = new Date();
      await db.transaction(async (tx) => {
        await tx
          .update(companyProviderKeys)
          .set({ status: "revoked", updatedAt: now })
          .where(eq(companyProviderKeys.id, keyId));

        await tx
          .update(userProviderKeyAssignments)
          .set({ revokedAt: now, updatedAt: now })
          .where(
            and(
              eq(userProviderKeyAssignments.companyId, companyId),
              eq(userProviderKeyAssignments.providerKeyId, keyId),
              isNull(userProviderKeyAssignments.revokedAt),
            ),
          );
      });

      return getProviderKey(companyId, keyId);
    },

    listAssignments: async (companyId: string) =>
      db
        .select({
          assignmentId: userProviderKeyAssignments.id,
          companyId: userProviderKeyAssignments.companyId,
          userId: userProviderKeyAssignments.userId,
          userName: authUsers.name,
          userEmail: authUsers.email,
          providerKeyId: userProviderKeyAssignments.providerKeyId,
          provider: companyProviderKeys.provider,
          providerKeyName: companyProviderKeys.name,
          assignmentMode: userProviderKeyAssignments.assignmentMode,
          assignedByUserId: userProviderKeyAssignments.assignedByUserId,
          assignedAt: userProviderKeyAssignments.assignedAt,
          revokedAt: userProviderKeyAssignments.revokedAt,
        })
        .from(userProviderKeyAssignments)
        .innerJoin(authUsers, eq(authUsers.id, userProviderKeyAssignments.userId))
        .innerJoin(companyProviderKeys, eq(companyProviderKeys.id, userProviderKeyAssignments.providerKeyId))
        .where(eq(userProviderKeyAssignments.companyId, companyId))
        .orderBy(desc(userProviderKeyAssignments.assignedAt)),

    assignUserProviderKey: async (
      companyId: string,
      userId: string,
      input: {
        providerKeyId: string;
        assignmentMode: "exclusive" | "shared";
        assignedByUserId: string | null;
      },
    ) => {
      const [membership, providerKey] = await Promise.all([
        db
          .select({ id: companyMemberships.id })
          .from(companyMemberships)
          .where(
            and(
              eq(companyMemberships.companyId, companyId),
              eq(companyMemberships.principalType, "user"),
              eq(companyMemberships.principalId, userId),
              eq(companyMemberships.status, "active"),
            ),
          )
          .then((rows) => rows[0] ?? null),
        getProviderKey(companyId, input.providerKeyId),
      ]);

      if (!membership) throw notFound("Active user membership not found");
      if (!providerKey) throw notFound("Provider key not found");
      if (providerKey.status !== "active") throw conflict("Provider key is not active");

      const now = new Date();
      await db.transaction(async (tx) => {
        await tx
          .update(userProviderKeyAssignments)
          .set({ revokedAt: now, updatedAt: now })
          .where(
            and(
              eq(userProviderKeyAssignments.companyId, companyId),
              eq(userProviderKeyAssignments.userId, userId),
              isNull(userProviderKeyAssignments.revokedAt),
            ),
          );

        await tx.insert(userProviderKeyAssignments).values({
          companyId,
          userId,
          providerKeyId: input.providerKeyId,
          assignmentMode: input.assignmentMode,
          assignedByUserId: input.assignedByUserId,
          assignedAt: now,
          updatedAt: now,
        });
      });

      return db
        .select({
          assignmentId: userProviderKeyAssignments.id,
          companyId: userProviderKeyAssignments.companyId,
          userId: userProviderKeyAssignments.userId,
          userName: authUsers.name,
          userEmail: authUsers.email,
          providerKeyId: userProviderKeyAssignments.providerKeyId,
          provider: companyProviderKeys.provider,
          providerKeyName: companyProviderKeys.name,
          assignmentMode: userProviderKeyAssignments.assignmentMode,
          assignedByUserId: userProviderKeyAssignments.assignedByUserId,
          assignedAt: userProviderKeyAssignments.assignedAt,
          revokedAt: userProviderKeyAssignments.revokedAt,
        })
        .from(userProviderKeyAssignments)
        .innerJoin(authUsers, eq(authUsers.id, userProviderKeyAssignments.userId))
        .innerJoin(companyProviderKeys, eq(companyProviderKeys.id, userProviderKeyAssignments.providerKeyId))
        .where(
          and(
            eq(userProviderKeyAssignments.companyId, companyId),
            eq(userProviderKeyAssignments.userId, userId),
            isNull(userProviderKeyAssignments.revokedAt),
          ),
        )
        .then((rows) => rows[0] ?? null);
    },

    revokeUserAssignment: async (companyId: string, userId: string) => {
      const now = new Date();
      const activeAssignment = await db
        .select()
        .from(userProviderKeyAssignments)
        .where(
          and(
            eq(userProviderKeyAssignments.companyId, companyId),
            eq(userProviderKeyAssignments.userId, userId),
            isNull(userProviderKeyAssignments.revokedAt),
          ),
        )
        .then((rows) => rows[0] ?? null);

      if (!activeAssignment) return null;

      return db
        .update(userProviderKeyAssignments)
        .set({ revokedAt: now, updatedAt: now })
        .where(eq(userProviderKeyAssignments.id, activeAssignment.id))
        .returning()
        .then((rows) => rows[0] ?? null);
    },

    getActiveAssignmentForUser: async (
      companyId: string,
      userId: string,
      provider?: string,
    ) =>
      db
        .select({
          assignmentId: userProviderKeyAssignments.id,
          companyId: userProviderKeyAssignments.companyId,
          userId: userProviderKeyAssignments.userId,
          userName: authUsers.name,
          userEmail: authUsers.email,
          providerKeyId: userProviderKeyAssignments.providerKeyId,
          provider: companyProviderKeys.provider,
          providerKeyName: companyProviderKeys.name,
          assignmentMode: userProviderKeyAssignments.assignmentMode,
          assignedByUserId: userProviderKeyAssignments.assignedByUserId,
          assignedAt: userProviderKeyAssignments.assignedAt,
          revokedAt: userProviderKeyAssignments.revokedAt,
          secretId: companyProviderKeys.secretId,
          secretVersion: companyProviderKeys.secretVersion,
          providerKeyStatus: companyProviderKeys.status,
        })
        .from(userProviderKeyAssignments)
        .innerJoin(authUsers, eq(authUsers.id, userProviderKeyAssignments.userId))
        .innerJoin(companyProviderKeys, eq(companyProviderKeys.id, userProviderKeyAssignments.providerKeyId))
        .where(
          and(
            eq(userProviderKeyAssignments.companyId, companyId),
            eq(userProviderKeyAssignments.userId, userId),
            isNull(userProviderKeyAssignments.revokedAt),
            eq(companyProviderKeys.status, "active"),
            ...(provider ? [eq(companyProviderKeys.provider, provider)] : []),
          ),
        )
        .then((rows) => rows[0] ?? null),

    findAssignmentForProviderKeyAtTime: async (
      companyId: string,
      providerKeyId: string,
      occurredAt: Date,
    ) => {
      const rows = await db
        .select({
          assignmentId: userProviderKeyAssignments.id,
          userId: userProviderKeyAssignments.userId,
          userName: authUsers.name,
          userEmail: authUsers.email,
        })
        .from(userProviderKeyAssignments)
        .innerJoin(authUsers, eq(authUsers.id, userProviderKeyAssignments.userId))
        .where(
          and(
            eq(userProviderKeyAssignments.companyId, companyId),
            eq(userProviderKeyAssignments.providerKeyId, providerKeyId),
            lte(userProviderKeyAssignments.assignedAt, occurredAt),
            or(
              isNull(userProviderKeyAssignments.revokedAt),
              gt(userProviderKeyAssignments.revokedAt, occurredAt),
            ),
          ),
        );

      return rows.length === 1 ? rows[0] : null;
    },
  };
}
