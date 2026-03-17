import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@/lib/router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { dashboardApi } from "../api/dashboard";
import { activityApi } from "../api/activity";
import { issuesApi } from "../api/issues";
import { agentsApi } from "../api/agents";
import { projectsApi } from "../api/projects";
import { heartbeatsApi } from "../api/heartbeats";
import { costsApi } from "../api/costs";
import { accessApi } from "../api/access";
import { providerProxyApi } from "../api/providerProxy";
import { useCompany } from "../context/CompanyContext";
import { useDialog } from "../context/DialogContext";
import { useBreadcrumbs } from "../context/BreadcrumbContext";
import { queryKeys } from "../lib/queryKeys";
import { MetricCard } from "../components/MetricCard";
import { EmptyState } from "../components/EmptyState";
import { StatusIcon } from "../components/StatusIcon";
import { PriorityIcon } from "../components/PriorityIcon";
import { ActivityRow } from "../components/ActivityRow";
import { Identity } from "../components/Identity";
import { timeAgo } from "../lib/timeAgo";
import { cn, formatCents } from "../lib/utils";
import { Bot, CircleDot, DollarSign, ShieldCheck, LayoutDashboard, PauseCircle } from "lucide-react";
import { ActiveAgentsPanel } from "../components/ActiveAgentsPanel";
import { ChartCard, RunActivityChart, PriorityChart, IssueStatusChart, SuccessRateChart } from "../components/ActivityCharts";
import { PageSkeleton } from "../components/PageSkeleton";
import { UserProviderKeysPanel } from "../components/UserProviderKeysPanel";
import type { Agent, Issue } from "@paperclipai/shared";
import { PluginSlotOutlet } from "@/plugins/slots";

function getRecentIssues(issues: Issue[]): Issue[] {
  return [...issues]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export function Dashboard() {
  const { selectedCompanyId, companies } = useCompany();
  const { openOnboarding } = useDialog();
  const { setBreadcrumbs } = useBreadcrumbs();
  const queryClient = useQueryClient();
  const [animatedActivityIds, setAnimatedActivityIds] = useState<Set<string>>(new Set());
  const seenActivityIdsRef = useRef<Set<string>>(new Set());
  const hydratedActivityRef = useRef(false);
  const activityAnimationTimersRef = useRef<number[]>([]);
  const [proxyTargetUserId, setProxyTargetUserId] = useState("");
  const [proxyModel, setProxyModel] = useState("gpt-4.1-mini");
  const [proxyPrompt, setProxyPrompt] = useState("Return a one-line confirmation that this 302 proxy path is working.");
  const [proxyResult, setProxyResult] = useState<string | null>(null);
  const [syncProviderKeyId, setSyncProviderKeyId] = useState("");
  const [syncResult, setSyncResult] = useState<string | null>(null);

  const { data: agents } = useQuery({
    queryKey: queryKeys.agents.list(selectedCompanyId!),
    queryFn: () => agentsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  useEffect(() => {
    setBreadcrumbs([{ label: "Dashboard" }]);
  }, [setBreadcrumbs]);

  const { data, isLoading, error } = useQuery({
    queryKey: queryKeys.dashboard(selectedCompanyId!),
    queryFn: () => dashboardApi.summary(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const { data: activity } = useQuery({
    queryKey: queryKeys.activity(selectedCompanyId!),
    queryFn: () => activityApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const { data: issues } = useQuery({
    queryKey: queryKeys.issues.list(selectedCompanyId!),
    queryFn: () => issuesApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const { data: projects } = useQuery({
    queryKey: queryKeys.projects.list(selectedCompanyId!),
    queryFn: () => projectsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const { data: runs } = useQuery({
    queryKey: queryKeys.heartbeats(selectedCompanyId!),
    queryFn: () => heartbeatsApi.list(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const { data: userCosts } = useQuery({
    queryKey: queryKeys.costsByUser(selectedCompanyId!),
    queryFn: () => costsApi.byUser(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const { data: providerRequestLogs } = useQuery({
    queryKey: queryKeys.providerRequestLogs(selectedCompanyId!, { limit: 12 }),
    queryFn: () => costsApi.providerRequestLogs(selectedCompanyId!, { limit: 12 }),
    enabled: !!selectedCompanyId,
  });

  const { data: assignments } = useQuery({
    queryKey: selectedCompanyId ? queryKeys.access.userKeyAssignments(selectedCompanyId) : ["access", "user-key-assignments", "none"],
    queryFn: () => accessApi.listUserKeyAssignments(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const { data: providerKeys } = useQuery({
    queryKey: selectedCompanyId ? queryKeys.access.providerKeys(selectedCompanyId) : ["access", "provider-keys", "none"],
    queryFn: () => accessApi.listProviderKeys(selectedCompanyId!),
    enabled: !!selectedCompanyId,
  });

  const recentIssues = issues ? getRecentIssues(issues) : [];
  const recentActivity = useMemo(() => (activity ?? []).slice(0, 10), [activity]);
  const userCostRows = userCosts ?? [];
  const providerLogRows = providerRequestLogs ?? [];
  const trackedUserSpend = userCostRows.reduce((sum, row) => sum + row.costCents, 0);
  const activeAssignedUsers = useMemo(
    () => (assignments ?? []).filter((assignment) => !assignment.revokedAt && assignment.provider === "302ai"),
    [assignments],
  );
  const active302Keys = useMemo(
    () => (providerKeys ?? []).filter((key) => key.provider === "302ai" && key.status !== "revoked"),
    [providerKeys],
  );

  useEffect(() => {
    if (!activeAssignedUsers.length) {
      setProxyTargetUserId("");
      return;
    }
    setProxyTargetUserId((current) =>
      activeAssignedUsers.some((assignment) => assignment.userId === current)
        ? current
        : activeAssignedUsers[0]!.userId,
    );
  }, [activeAssignedUsers]);

  useEffect(() => {
    if (!active302Keys.length) {
      setSyncProviderKeyId("");
      return;
    }
    setSyncProviderKeyId((current) =>
      active302Keys.some((key) => key.id === current)
        ? current
        : active302Keys[0]!.id,
    );
  }, [active302Keys]);

  const proxyMutation = useMutation({
    mutationFn: async () => {
      if (!selectedCompanyId) throw new Error("No company selected");
      if (!proxyTargetUserId) throw new Error("Select a user assignment first");
      return providerProxyApi.chatCompletion(selectedCompanyId, {
        targetUserId: proxyTargetUserId,
        payload: {
          model: proxyModel.trim(),
          messages: [{ role: "user", content: proxyPrompt.trim() }],
          temperature: 0,
        },
      });
    },
    onSuccess: async (result) => {
      setProxyResult(JSON.stringify(result, null, 2));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.costsByUser(selectedCompanyId!) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.providerRequestLogs(selectedCompanyId!, { limit: 12 }) }),
      ]);
    },
    onError: (error) => {
      setProxyResult(error instanceof Error ? error.message : "302 proxy request failed");
    },
  });

  const syncLogsMutation = useMutation({
    mutationFn: async () => {
      if (!selectedCompanyId) throw new Error("No company selected");
      if (!syncProviderKeyId) throw new Error("Select a 302 provider key first");
      return providerProxyApi.syncLogs(selectedCompanyId, syncProviderKeyId, {});
    },
    onSuccess: async (result) => {
      setSyncResult(JSON.stringify(result, null, 2));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.costsByUser(selectedCompanyId!) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.providerRequestLogs(selectedCompanyId!, { limit: 12 }) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.access.providerKeys(selectedCompanyId!) }),
      ]);
    },
    onError: (error) => {
      setSyncResult(error instanceof Error ? error.message : "302 log sync failed");
    },
  });

  useEffect(() => {
    for (const timer of activityAnimationTimersRef.current) {
      window.clearTimeout(timer);
    }
    activityAnimationTimersRef.current = [];
    seenActivityIdsRef.current = new Set();
    hydratedActivityRef.current = false;
    setAnimatedActivityIds(new Set());
  }, [selectedCompanyId]);

  useEffect(() => {
    if (recentActivity.length === 0) return;

    const seen = seenActivityIdsRef.current;
    const currentIds = recentActivity.map((event) => event.id);

    if (!hydratedActivityRef.current) {
      for (const id of currentIds) seen.add(id);
      hydratedActivityRef.current = true;
      return;
    }

    const newIds = currentIds.filter((id) => !seen.has(id));
    if (newIds.length === 0) {
      for (const id of currentIds) seen.add(id);
      return;
    }

    setAnimatedActivityIds((prev) => {
      const next = new Set(prev);
      for (const id of newIds) next.add(id);
      return next;
    });

    for (const id of newIds) seen.add(id);

    const timer = window.setTimeout(() => {
      setAnimatedActivityIds((prev) => {
        const next = new Set(prev);
        for (const id of newIds) next.delete(id);
        return next;
      });
      activityAnimationTimersRef.current = activityAnimationTimersRef.current.filter((t) => t !== timer);
    }, 980);
    activityAnimationTimersRef.current.push(timer);
  }, [recentActivity]);

  useEffect(() => {
    return () => {
      for (const timer of activityAnimationTimersRef.current) {
        window.clearTimeout(timer);
      }
    };
  }, []);

  const agentMap = useMemo(() => {
    const map = new Map<string, Agent>();
    for (const a of agents ?? []) map.set(a.id, a);
    return map;
  }, [agents]);

  const entityNameMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const i of issues ?? []) map.set(`issue:${i.id}`, i.identifier ?? i.id.slice(0, 8));
    for (const a of agents ?? []) map.set(`agent:${a.id}`, a.name);
    for (const p of projects ?? []) map.set(`project:${p.id}`, p.name);
    return map;
  }, [issues, agents, projects]);

  const entityTitleMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const i of issues ?? []) map.set(`issue:${i.id}`, i.title);
    return map;
  }, [issues]);

  const agentName = (id: string | null) => {
    if (!id || !agents) return null;
    return agents.find((a) => a.id === id)?.name ?? null;
  };

  if (!selectedCompanyId) {
    if (companies.length === 0) {
      return (
        <EmptyState
          icon={LayoutDashboard}
          message="Welcome to Paperclip. Set up your first company and agent to get started."
          action="Get Started"
          onAction={openOnboarding}
        />
      );
    }
    return (
      <EmptyState icon={LayoutDashboard} message="Create or select a company to view the dashboard." />
    );
  }

  if (isLoading) {
    return <PageSkeleton variant="dashboard" />;
  }

  const hasNoAgents = agents !== undefined && agents.length === 0;

  return (
    <div className="space-y-6">
      {error && <p className="text-sm text-destructive">{error.message}</p>}

      {hasNoAgents && (
        <div className="flex items-center justify-between gap-3 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 dark:border-amber-500/25 dark:bg-amber-950/60">
          <div className="flex items-center gap-2.5">
            <Bot className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <p className="text-sm text-amber-900 dark:text-amber-100">
              You have no agents.
            </p>
          </div>
          <button
            onClick={() => openOnboarding({ initialStep: 2, companyId: selectedCompanyId! })}
            className="text-sm font-medium text-amber-700 hover:text-amber-900 dark:text-amber-300 dark:hover:text-amber-100 underline underline-offset-2 shrink-0"
          >
            Create one here
          </button>
        </div>
      )}

      <ActiveAgentsPanel companyId={selectedCompanyId!} />

      {data && (
        <>
          {data.budgets.activeIncidents > 0 ? (
            <div className="flex items-start justify-between gap-3 rounded-xl border border-red-500/20 bg-[linear-gradient(180deg,rgba(255,80,80,0.12),rgba(255,255,255,0.02))] px-4 py-3">
              <div className="flex items-start gap-2.5">
                <PauseCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-300" />
                <div>
                  <p className="text-sm font-medium text-red-50">
                    {data.budgets.activeIncidents} active budget incident{data.budgets.activeIncidents === 1 ? "" : "s"}
                  </p>
                  <p className="text-xs text-red-100/70">
                    {data.budgets.pausedAgents} agents paused · {data.budgets.pausedProjects} projects paused · {data.budgets.pendingApprovals} pending budget approvals
                  </p>
                </div>
              </div>
              <Link to="/costs" className="text-sm underline underline-offset-2 text-red-100">
                Open budgets
              </Link>
            </div>
          ) : null}

          <div className="grid grid-cols-2 xl:grid-cols-4 gap-1 sm:gap-2">
            <MetricCard
              icon={Bot}
              value={data.agents.active + data.agents.running + data.agents.paused + data.agents.error}
              label="Agents Enabled"
              to="/agents"
              description={
                <span>
                  {data.agents.running} running{", "}
                  {data.agents.paused} paused{", "}
                  {data.agents.error} errors
                </span>
              }
            />
            <MetricCard
              icon={CircleDot}
              value={data.tasks.inProgress}
              label="Tasks In Progress"
              to="/issues"
              description={
                <span>
                  {data.tasks.open} open{", "}
                  {data.tasks.blocked} blocked
                </span>
              }
            />
            <MetricCard
              icon={DollarSign}
              value={formatCents(data.costs.monthSpendCents)}
              label="Month Spend"
              to="/costs"
              description={
                <span>
                  {data.costs.monthBudgetCents > 0
                    ? `${data.costs.monthUtilizationPercent}% of ${formatCents(data.costs.monthBudgetCents)} budget`
                    : "Unlimited budget"}
                </span>
              }
            />
            <MetricCard
              icon={ShieldCheck}
              value={data.pendingApprovals + data.budgets.pendingApprovals}
              label="Pending Approvals"
              to="/approvals"
              description={
                <span>
                  {data.budgets.pendingApprovals > 0
                    ? `${data.budgets.pendingApprovals} budget overrides awaiting board review`
                    : "Awaiting board review"}
                </span>
              }
            />
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <ChartCard title="Run Activity" subtitle="Last 14 days">
              <RunActivityChart runs={runs ?? []} />
            </ChartCard>
            <ChartCard title="Issues by Priority" subtitle="Last 14 days">
              <PriorityChart issues={issues ?? []} />
            </ChartCard>
            <ChartCard title="Issues by Status" subtitle="Last 14 days">
              <IssueStatusChart issues={issues ?? []} />
            </ChartCard>
            <ChartCard title="Success Rate" subtitle="Last 14 days">
              <SuccessRateChart runs={runs ?? []} />
            </ChartCard>
          </div>

          <PluginSlotOutlet
            slotTypes={["dashboardWidget"]}
            context={{ companyId: selectedCompanyId }}
            className="grid gap-4 md:grid-cols-2"
            itemClassName="rounded-lg border bg-card p-4 shadow-sm"
          />

          <div className="space-y-3">
            <div>
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Admin Users
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Register 302 provider keys and assign them to active company members from the main
                control panel.
              </p>
            </div>
            <UserProviderKeysPanel />
            <div className="space-y-3 rounded-md border border-border px-4 py-4">
              <div>
                <h4 className="text-sm font-medium">302 Chat Probe</h4>
                <p className="mt-1 text-sm text-muted-foreground">
                  Send a non-stream chat completion through the assigned 302 key for a selected user.
                </p>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Assigned user</label>
                  <select
                    className="w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm outline-none"
                    value={proxyTargetUserId}
                    onChange={(event) => setProxyTargetUserId(event.target.value)}
                  >
                    <option value="">Select assigned user</option>
                    {activeAssignedUsers.map((assignment) => (
                      <option key={assignment.assignmentId} value={assignment.userId}>
                        {(assignment.userName ?? assignment.userEmail ?? assignment.userId)} · {assignment.providerKeyName}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Model</label>
                  <input
                    className="w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm outline-none"
                    type="text"
                    value={proxyModel}
                    onChange={(event) => setProxyModel(event.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Prompt</label>
                <textarea
                  className="min-h-24 w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm outline-none"
                  value={proxyPrompt}
                  onChange={(event) => setProxyPrompt(event.target.value)}
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="inline-flex items-center rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={
                    proxyMutation.isPending ||
                    !proxyTargetUserId ||
                    !proxyModel.trim() ||
                    !proxyPrompt.trim()
                  }
                  onClick={() => proxyMutation.mutate()}
                >
                  {proxyMutation.isPending ? "Sending..." : "Run 302 Chat Probe"}
                </button>
                <span className="text-xs text-muted-foreground">
                  {activeAssignedUsers.length} users with active 302 assignments
                </span>
              </div>
              {proxyResult && (
                <pre className="overflow-x-auto rounded-md border border-border bg-muted/30 p-3 text-xs">
                  {proxyResult}
                </pre>
              )}
            </div>
            <div className="space-y-3 rounded-md border border-border px-4 py-4">
              <div>
                <h4 className="text-sm font-medium">302 Log Sync</h4>
                <p className="mt-1 text-sm text-muted-foreground">
                  Pull the latest 24 hours of API Log Query rows from 302 and reconcile them into the local user ledger.
                </p>
              </div>
              <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">302 provider key</label>
                  <select
                    className="w-full rounded-md border border-border bg-transparent px-2.5 py-1.5 text-sm outline-none"
                    value={syncProviderKeyId}
                    onChange={(event) => setSyncProviderKeyId(event.target.value)}
                  >
                    <option value="">Select 302 key</option>
                    {active302Keys.map((key) => (
                      <option key={key.id} value={key.id}>
                        {key.name}
                        {key.lastSyncedAt ? ` · last sync ${timeAgo(key.lastSyncedAt)}` : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  className="inline-flex items-center rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={syncLogsMutation.isPending || !syncProviderKeyId}
                  onClick={() => syncLogsMutation.mutate()}
                >
                  {syncLogsMutation.isPending ? "Syncing..." : "Sync Last 24h"}
                </button>
              </div>
              <div className="text-xs text-muted-foreground">
                {active302Keys.length} registered 302 keys available for reconciliation
              </div>
              {syncResult && (
                <pre className="overflow-x-auto rounded-md border border-border bg-muted/30 p-3 text-xs">
                  {syncResult}
                </pre>
              )}
            </div>
          </div>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1.4fr)]">
            <div className="space-y-3 rounded-md border border-border px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    User Spend
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Consumption tracked against explicit `userId` in the local provider request ledger.
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-lg font-semibold">{formatCents(trackedUserSpend)}</div>
                  <div className="text-xs text-muted-foreground">{userCostRows.length} tracked rows</div>
                </div>
              </div>
              {userCostRows.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No user-attributed spend recorded yet. Once 302 requests are proxied with `userId`,
                  this table will populate.
                </p>
              ) : (
                <div className="space-y-2">
                  {userCostRows.slice(0, 8).map((row) => (
                    <div
                      key={`${row.userId}:${row.providerKeyId ?? "none"}`}
                      className="flex items-start justify-between gap-3 rounded-md border border-border px-3 py-3"
                    >
                      <div className="min-w-0">
                        <div className="font-medium">
                          {row.userName ?? row.userEmail ?? row.userId}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {row.userEmail ?? row.userId}
                          {row.providerKeyName ? ` · ${row.providerKeyName}` : ""}
                          {row.provider ? ` · ${row.provider}` : ""}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {row.requestCount} requests · in {row.inputTokens} · out {row.outputTokens}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="font-medium">{formatCents(row.costCents)}</div>
                        <div className="text-xs text-muted-foreground">
                          {row.lastOccurredAt ? timeAgo(row.lastOccurredAt) : "No recent usage"}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-3 rounded-md border border-border px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    Recent Provider Logs
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Latest mapped provider requests, ready for 302 reconciliation by `externalRequestId`.
                  </p>
                </div>
                <div className="text-xs text-muted-foreground">
                  {providerLogRows.length} shown
                </div>
              </div>
              {providerLogRows.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No provider request logs captured yet.
                </p>
              ) : (
                <div className="space-y-2">
                  {providerLogRows.map((row) => (
                    <div key={row.id} className="rounded-md border border-border px-3 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-medium">
                            {row.userName ?? row.userEmail ?? row.userId ?? "Unmapped user"}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {row.provider} · {row.model}
                            {row.providerKeyName ? ` · ${row.providerKeyName}` : ""}
                          </div>
                          <div className="mt-1 font-mono text-xs text-muted-foreground">
                            {row.externalRequestId}
                          </div>
                        </div>
                        <div className="shrink-0 text-right text-xs text-muted-foreground">
                          <div>{row.status}{row.httpStatus ? ` · ${row.httpStatus}` : ""}</div>
                          <div>{timeAgo(row.requestStartedAt)}</div>
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span>{row.requestMethod ?? "POST"} {row.requestPath ?? "/"}</span>
                        <span>cost {row.costCents != null ? formatCents(row.costCents) : "pending"}</span>
                        <span>in {row.inputTokens}</span>
                        <span>out {row.outputTokens}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {/* Recent Activity */}
            {recentActivity.length > 0 && (
              <div className="min-w-0">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                  Recent Activity
                </h3>
                <div className="border border-border divide-y divide-border overflow-hidden">
                  {recentActivity.map((event) => (
                    <ActivityRow
                      key={event.id}
                      event={event}
                      agentMap={agentMap}
                      entityNameMap={entityNameMap}
                      entityTitleMap={entityTitleMap}
                      className={animatedActivityIds.has(event.id) ? "activity-row-enter" : undefined}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Recent Tasks */}
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                Recent Tasks
              </h3>
              {recentIssues.length === 0 ? (
                <div className="border border-border p-4">
                  <p className="text-sm text-muted-foreground">No tasks yet.</p>
                </div>
              ) : (
                <div className="border border-border divide-y divide-border overflow-hidden">
                  {recentIssues.slice(0, 10).map((issue) => (
                    <Link
                      key={issue.id}
                      to={`/issues/${issue.identifier ?? issue.id}`}
                      className="px-4 py-3 text-sm cursor-pointer hover:bg-accent/50 transition-colors no-underline text-inherit block"
                    >
                      <div className="flex items-start gap-2 sm:items-center sm:gap-3">
                        {/* Status icon - left column on mobile */}
                        <span className="shrink-0 sm:hidden">
                          <StatusIcon status={issue.status} />
                        </span>

                        {/* Right column on mobile: title + metadata stacked */}
                        <span className="flex min-w-0 flex-1 flex-col gap-1 sm:contents">
                          <span className="line-clamp-2 text-sm sm:order-2 sm:flex-1 sm:min-w-0 sm:line-clamp-none sm:truncate">
                            {issue.title}
                          </span>
                          <span className="flex items-center gap-2 sm:order-1 sm:shrink-0">
                            <span className="hidden sm:inline-flex"><PriorityIcon priority={issue.priority} /></span>
                            <span className="hidden sm:inline-flex"><StatusIcon status={issue.status} /></span>
                            <span className="text-xs font-mono text-muted-foreground">
                              {issue.identifier ?? issue.id.slice(0, 8)}
                            </span>
                            {issue.assigneeAgentId && (() => {
                              const name = agentName(issue.assigneeAgentId);
                              return name
                                ? <span className="hidden sm:inline-flex"><Identity name={name} size="sm" /></span>
                                : null;
                            })()}
                            <span className="text-xs text-muted-foreground sm:hidden">&middot;</span>
                            <span className="text-xs text-muted-foreground shrink-0 sm:order-last">
                              {timeAgo(issue.updatedAt)}
                            </span>
                          </span>
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>

        </>
      )}
    </div>
  );
}
