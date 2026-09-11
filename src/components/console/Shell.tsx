import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSession, useRoles } from "@/hooks/useSession";
import { effectiveStatus, relativeTime } from "@/lib/fleet";
import type { NodeRow } from "@/lib/fleet";

const NAV = [
  { to: "/", label: "Overview", key: "OV" },
  { to: "/nodes", label: "Nodes", key: "ND" },
  { to: "/commands", label: "Commands", key: "CM" },
  { to: "/alerts", label: "Alerts", key: "AL" },
  { to: "/audit", label: "Audit", key: "AU" },
  { to: "/observability", label: "Observability", key: "OB" },
  { to: "/settings", label: "Settings", key: "ST" },
] as const;

function useFleetSummary() {
  return useQuery({
    queryKey: ["fleet-summary"],
    refetchInterval: 15000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("nodes")
        .select("id,status,last_heartbeat_at,heartbeat_interval_seconds,enabled");
      if (error) throw error;
      const nodes = (data ?? []) as Pick<
        NodeRow,
        "id" | "status" | "last_heartbeat_at" | "heartbeat_interval_seconds" | "enabled"
      >[];
      const counts = { online: 0, degraded: 0, offline: 0, other: 0 };
      let freshest: string | null = null;
      for (const n of nodes) {
        const s = effectiveStatus(n);
        if (s === "online") counts.online += 1;
        else if (s === "degraded" || s === "recovering") counts.degraded += 1;
        else if (s === "offline") counts.offline += 1;
        else counts.other += 1;
        if (n.last_heartbeat_at && (!freshest || n.last_heartbeat_at > freshest)) freshest = n.last_heartbeat_at;
      }
      return { total: nodes.length, ...counts, freshest };
    },
  });
}

export function Shell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user } = useSession();
  const { data: roles } = useRoles(user?.id);
  const { data: summary } = useFleetSummary();

  const role = roles?.includes("admin") ? "admin" : roles?.includes("operator") ? "operator" : "viewer";

  return (
    <div className="flex min-h-screen bg-background">
      <nav
        aria-label="Console sections"
        className="sticky top-0 flex h-screen w-[188px] shrink-0 flex-col border-r border-border bg-rail"
      >
        <div className="flex items-center gap-2 border-b border-border px-3 py-3">
          <span className="grid h-6 w-6 place-items-center rounded-sm border border-primary/50 bg-primary/15 font-mono text-[11px] font-semibold text-primary">
            F
          </span>
          <div className="leading-tight">
            <div className="text-[13px] font-semibold tracking-tight">FleetOps</div>
            <div className="font-mono text-[10px] text-muted-foreground">control plane</div>
          </div>
        </div>

        <ul className="flex-1 space-y-0.5 p-2">
          {NAV.map((item) => {
            const active = item.to === "/" ? pathname === "/" : pathname.startsWith(item.to);
            return (
              <li key={item.to}>
                <Link
                  to={item.to}
                  className={`flex items-center gap-2 rounded-sm px-2 py-1.5 text-[12.5px] transition-colors ${
                    active
                      ? "bg-surface-raised text-foreground shadow-[inset_2px_0_0_0_var(--primary)]"
                      : "text-muted-foreground hover:bg-surface hover:text-foreground"
                  }`}
                >
                  <span className="font-mono text-[10px] text-muted-foreground">{item.key}</span>
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="border-t border-border p-2.5">
          <div className="label-caps">Operator</div>
          <div className="mt-0.5 truncate font-mono text-[11.5px]" title={user?.email ?? ""}>
            {user?.email ?? "—"}
          </div>
          <div className="mt-1 flex items-center justify-between">
            <span className="rounded-sm border border-border px-1 py-0.5 font-mono text-[10px] uppercase text-muted-foreground">
              {role}
            </span>
            <button
              className="text-[11.5px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
              onClick={() => supabase.auth.signOut()}
            >
              Sign out
            </button>
          </div>
        </div>
      </nav>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex flex-wrap items-center gap-x-5 gap-y-1 border-b border-border bg-background/95 px-4 py-2 backdrop-blur">
          <span className="rounded-sm border border-border px-1.5 py-0.5 font-mono text-[10.5px] uppercase tracking-wider text-muted-foreground">
            env: production
          </span>
          <FleetPulse label="nodes" value={summary?.total ?? 0} tone="text-foreground" />
          <FleetPulse label="online" value={summary?.online ?? 0} tone="text-ok" />
          <FleetPulse label="degraded" value={summary?.degraded ?? 0} tone="text-warn" />
          <FleetPulse label="offline" value={summary?.offline ?? 0} tone="text-crit" />
          <span className="ml-auto font-mono text-[11px] text-muted-foreground">
            last heartbeat {relativeTime(summary?.freshest ?? null)}
          </span>
        </header>

        <main className="min-w-0 flex-1 space-y-4 p-4">{children}</main>
      </div>
    </div>
  );
}

function FleetPulse({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <span className="flex items-baseline gap-1.5">
      <span className="label-caps">{label}</span>
      <span className={`mono-num text-[13px] ${tone}`}>{String(value).padStart(2, "0")}</span>
    </span>
  );
}
