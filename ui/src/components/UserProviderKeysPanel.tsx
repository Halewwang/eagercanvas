import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { accessApi } from "../api/access";
import { secretsApi } from "../api/secrets";
import { queryKeys } from "../lib/queryKeys";
import { useCompany } from "../context/CompanyContext";
import { Button } from "@/components/ui/button";
import { Field } from "../components/agent-config-primitives";

export function UserProviderKeysPanel() {
  const { selectedCompanyId } = useCompany();
  const queryClient = useQueryClient();
  const [providerName, setProviderName] = useState("302ai");
  const [providerKeyName, setProviderKeyName] = useState("");
  const [providerSecretId, setProviderSecretId] = useState("");
  const [providerExternalKeyId, setProviderExternalKeyId] = useState("");
  const [providerFormError, setProviderFormError] = useState<string | null>(null);
  const [assignmentDrafts, setAssignmentDrafts] = useState<Record<string, string>>({});

  const membersQuery = useQuery({
    queryKey: selectedCompanyId ? queryKeys.access.members(selectedCompanyId) : ["access", "members", "none"],
    queryFn: () => accessApi.listMembers(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const providerKeysQuery = useQuery({
    queryKey: selectedCompanyId
      ? queryKeys.access.providerKeys(selectedCompanyId)
      : ["access", "provider-keys", "none"],
    queryFn: () => accessApi.listProviderKeys(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const assignmentsQuery = useQuery({
    queryKey: selectedCompanyId
      ? queryKeys.access.userKeyAssignments(selectedCompanyId)
      : ["access", "user-key-assignments", "none"],
    queryFn: () => accessApi.listUserKeyAssignments(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const secretsQuery = useQuery({
    queryKey: selectedCompanyId ? queryKeys.secrets.list(selectedCompanyId) : ["secrets", "none"],
    queryFn: () => secretsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  useEffect(() => {
    if (!selectedCompanyId) return;
    const nextDrafts: Record<string, string> = {};
    for (const assignment of assignmentsQuery.data ?? []) {
      if (assignment.revokedAt) continue;
      nextDrafts[assignment.userId] = assignment.providerKeyId;
    }
    setAssignmentDrafts(nextDrafts);
  }, [assignmentsQuery.data, selectedCompanyId]);

  const providerKeyMutation = useMutation({
    mutationFn: () =>
      accessApi.createProviderKey(selectedCompanyId!, {
        provider: providerName.trim(),
        name: providerKeyName.trim(),
        secretId: providerSecretId,
        externalKeyId: providerExternalKeyId.trim() || null,
      }),
    onSuccess: async () => {
      setProviderFormError(null);
      setProviderKeyName("");
      setProviderSecretId("");
      setProviderExternalKeyId("");
      await queryClient.invalidateQueries({ queryKey: queryKeys.access.providerKeys(selectedCompanyId!) });
    },
    onError: (error) => {
      setProviderFormError(error instanceof Error ? error.message : "Failed to create provider key");
    },
  });

  const assignMutation = useMutation({
    mutationFn: ({ userId, providerKeyId }: { userId: string; providerKeyId: string }) =>
      accessApi.assignUserProviderKey(selectedCompanyId!, userId, {
        providerKeyId,
        assignmentMode: "exclusive",
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.access.userKeyAssignments(selectedCompanyId!) });
    },
  });

  const revokeAssignmentMutation = useMutation({
    mutationFn: (userId: string) => accessApi.revokeUserProviderKeyAssignment(selectedCompanyId!, userId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.access.userKeyAssignments(selectedCompanyId!) });
    },
  });

  const revokeProviderKeyMutation = useMutation({
    mutationFn: (keyId: string) => accessApi.revokeProviderKey(selectedCompanyId!, keyId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.access.providerKeys(selectedCompanyId!) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.access.userKeyAssignments(selectedCompanyId!) }),
      ]);
    },
  });

  if (!selectedCompanyId) {
    return (
      <div className="rounded-md border border-border px-4 py-4 text-sm text-muted-foreground">
        No company selected.
      </div>
    );
  }

  const activeMembers = (membersQuery.data ?? []).filter(
    (member) => member.principalType === "user" && member.status === "active",
  );
  const activeProviderKeys = (providerKeysQuery.data ?? []).filter((key) => key.status === "active");
  const activeAssignments = new Map(
    (assignmentsQuery.data ?? [])
      .filter((assignment) => !assignment.revokedAt)
      .map((assignment) => [assignment.userId, assignment]),
  );

  return (
    <div className="space-y-4 rounded-md border border-border px-4 py-4">
      <div className="space-y-1">
        <div className="text-sm font-medium">User Provider Keys</div>
        <p className="text-sm text-muted-foreground">
          Register company-scoped 302 provider keys and assign them to active human members.
        </p>
      </div>

      <div className="space-y-3">
        <div className="text-sm font-medium">Register company-scoped 302 key</div>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="Provider" hint="Use a stable provider label for reporting.">
            <input
              className="w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm outline-none"
              type="text"
              value={providerName}
              onChange={(e) => setProviderName(e.target.value)}
            />
          </Field>
          <Field label="Key name" hint="Internal display name shown to operators.">
            <input
              className="w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm outline-none"
              type="text"
              value={providerKeyName}
              onChange={(e) => setProviderKeyName(e.target.value)}
              placeholder="302 Key A"
            />
          </Field>
          <Field label="Secret" hint="Pick an existing secret that stores the real upstream key.">
            <select
              className="w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm outline-none"
              value={providerSecretId}
              onChange={(e) => setProviderSecretId(e.target.value)}
            >
              <option value="">Select secret</option>
              {(secretsQuery.data ?? []).map((secret) => (
                <option key={secret.id} value={secret.id}>
                  {secret.name} ({secret.provider})
                </option>
              ))}
            </select>
          </Field>
          <Field label="External key id" hint="Optional 302-side key id for reconciliation.">
            <input
              className="w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm outline-none"
              type="text"
              value={providerExternalKeyId}
              onChange={(e) => setProviderExternalKeyId(e.target.value)}
              placeholder="Optional"
            />
          </Field>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => providerKeyMutation.mutate()}
            disabled={
              providerKeyMutation.isPending ||
              !providerName.trim() ||
              !providerKeyName.trim() ||
              !providerSecretId
            }
          >
            {providerKeyMutation.isPending ? "Creating..." : "Create provider key"}
          </Button>
          {providerFormError && <span className="text-xs text-destructive">{providerFormError}</span>}
        </div>
      </div>

      <div className="space-y-2">
        <div className="text-sm font-medium">Registered keys</div>
        {(providerKeysQuery.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">No provider keys registered yet.</p>
        ) : (
          <div className="space-y-2">
            {(providerKeysQuery.data ?? []).map((key) => (
              <div key={key.id} className="rounded-md border border-border px-3 py-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{key.name}</span>
                      <span className="rounded border border-border px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                        {key.provider}
                      </span>
                      <span className="rounded border border-border px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                        {key.status}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      Secret {key.secretId.slice(0, 8)}
                      {key.externalKeyId ? ` · external ${key.externalKeyId}` : ""}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={revokeProviderKeyMutation.isPending || key.status === "revoked"}
                    onClick={() => revokeProviderKeyMutation.mutate(key.id)}
                  >
                    {key.status === "revoked" ? "Revoked" : "Revoke"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-2">
        <div className="text-sm font-medium">Assign keys to users</div>
        {membersQuery.isLoading || assignmentsQuery.isLoading ? (
          <p className="text-sm text-muted-foreground">Loading members...</p>
        ) : activeMembers.length === 0 ? (
          <p className="text-sm text-muted-foreground">No active human members in this company yet.</p>
        ) : (
          <div className="space-y-2">
            {activeMembers.map((member) => {
              const activeAssignment = activeAssignments.get(member.principalId);
              const draftKeyId = assignmentDrafts[member.principalId] ?? "";
              const canAssign = draftKeyId.length > 0 && draftKeyId !== activeAssignment?.providerKeyId;
              return (
                <div key={member.id} className="rounded-md border border-border px-3 py-3">
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="min-w-0">
                      <div className="font-medium">
                        {member.userName ?? member.userEmail ?? member.principalId}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {member.userEmail ?? member.principalId}
                        {member.membershipRole ? ` · ${member.membershipRole}` : ""}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {activeAssignment
                          ? `Assigned: ${activeAssignment.providerKeyName} (${activeAssignment.provider})`
                          : "No provider key assigned"}
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 md:min-w-80">
                      <select
                        className="w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm outline-none"
                        value={draftKeyId}
                        onChange={(e) =>
                          setAssignmentDrafts((current) => ({
                            ...current,
                            [member.principalId]: e.target.value,
                          }))}
                      >
                        <option value="">Select provider key</option>
                        {activeProviderKeys.map((key) => (
                          <option key={key.id} value={key.id}>
                            {key.name} ({key.provider})
                          </option>
                        ))}
                      </select>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          disabled={assignMutation.isPending || !canAssign}
                          onClick={() =>
                            assignMutation.mutate({
                              userId: member.principalId,
                              providerKeyId: draftKeyId,
                            })}
                        >
                          {assignMutation.isPending ? "Assigning..." : activeAssignment ? "Replace assignment" : "Assign key"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={revokeAssignmentMutation.isPending || !activeAssignment}
                          onClick={() => revokeAssignmentMutation.mutate(member.principalId)}
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
