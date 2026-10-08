import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Console } from "@/components/console/AuthGate";
import { PageHeader, Panel, Field, CodeBlock, EmptyState, ErrorState, TableSkeleton, inputClass, btnPrimaryClass, btnDangerClass } from "@/components/console/Primitives";
import { useCanOperate, useIsAdmin, useSession } from "@/hooks/useSession";
import { relativeTime, exactTime } from "@/lib/fleet";
import type { AppRole } from "@/lib/fleet";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — FleetOps" },
      { name: "description", content: "Enrollment tokens, node onboarding and operator roles for the FleetOps control plane." },
      { property: "og:title", content: "Settings — FleetOps" },
      { property: "og:description", content: "Enrollment tokens, node onboarding and operator roles for the FleetOps control plane." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: () => (
    <Console>
      <SettingsPage />
    </Console>
  ),
});

async function sha256Hex(v: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(v));
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function SettingsPage() {
  const canOperate = useCanOperate();
  const isAdmin = useIsAdmin();
  return (
    <>
      <PageHeader title="Settings" subtitle="Onboard nodes with one-time enrollment tokens and manage operator access." />
      {canOperate ? <Enrollment /> : <Panel title="Enrollment"><p className="p-3 text-[12.5px] text-muted-foreground">Operator or admin role required to create enrollment tokens.</p></Panel>}
      <Roles isAdmin={isAdmin} />
    </>
  );
}

function Enrollment() {
  const qc = useQueryClient();
  const { user } = useSession();
  const [label, setLabel] = useState("");
  const [environment, setEnvironment] = useState("production");
  const [hours, setHours] = useState(24);
  const [uses, setUses] = useState(1);
  const [created, setCreated] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const tokens = useQuery({
    queryKey: ["enrollment-tokens"],
    queryFn: async () => {
      const { data, error } = await supabase.from("enrollment_tokens").select("*").order("created_at", { ascending: false }).limit(50);
      if (error) throw error;
      return data ?? [];
    },
  });

  async function create() {
    if (!user) return;
    setBusy(true); setErr(null);
    const buf = new Uint8Array(24); crypto.getRandomValues(buf);
    const token = "fo_" + Array.from(buf).map((b) => b.toString(16).padStart(2, "0")).join("");
    const { error } = await supabase.from("enrollment_tokens").insert({
      token_hash: await sha256Hex(token), token_prefix: token.slice(0, 10),
      label: label || null, environment, max_uses: uses, created_by: user.id,
      expires_at: new Date(Date.now() + hours * 3600_000).toISOString(),
    });
    setBusy(false);
    if (error) return setErr(error.message);
    await supabase.from("audit_logs").insert({ action: "enrollment_token.created", actor_id: user.id, actor_label: user.email ?? null, target_type: "enrollment_token", details: { label, environment, max_uses: uses } as never });
    setCreated(token);
    qc.invalidateQueries({ queryKey: ["enrollment-tokens"] });
  }

  async function revoke(id: string) {
    await supabase.from("enrollment_tokens").update({ revoked_at: new Date().toISOString() }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["enrollment-tokens"] });
  }

  const origin = typeof window !== "undefined" ? window.location.origin : "https://your-fleetops-host";

  return (
    <>
      <Panel title="New enrollment token">
        <div className="grid gap-3 p-3 sm:grid-cols-4">
          <Field label="Label"><input className={inputClass} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="rack-b web tier" /></Field>
          <Field label="Environment"><input className={inputClass} value={environment} onChange={(e) => setEnvironment(e.target.value)} /></Field>
          <Field label="Expires in (hours)"><input type="number" min={1} max={720} className={inputClass} value={hours} onChange={(e) => setHours(Number(e.target.value) || 1)} /></Field>
          <Field label="Max uses"><input type="number" min={1} max={500} className={inputClass} value={uses} onChange={(e) => setUses(Number(e.target.value) || 1)} /></Field>
        </div>
        <div className="flex items-center gap-3 border-t border-border p-3">
          <button className={btnPrimaryClass} disabled={busy} onClick={create}>{busy ? "Creating…" : "Create token"}</button>
          {err && <span className="text-[12px] text-crit">{err}</span>}
        </div>
        {created && (
          <div className="space-y-2 border-t border-border p-3">
            <p className="text-[12.5px] text-warn">Copy this token now — it is shown only once and stored hashed.</p>
            <CodeBlock label="Token">{created}</CodeBlock>
            <CodeBlock label="Install on the Linux host (as root)">{`curl -fsSL ${origin}/install.sh | sudo FLEETOPS_URL=${origin} FLEETOPS_TOKEN=${created} bash`}</CodeBlock>
          </div>
        )}
      </Panel>

      <Panel title="Enrollment tokens">
        {tokens.isLoading ? <TableSkeleton rows={3} cols={5} /> : tokens.error ? <ErrorState message={(tokens.error as Error).message} /> : !tokens.data?.length ? (
          <EmptyState title="No tokens yet" hint="Create a token above to onboard your first node." />
        ) : (
          <table className="w-full text-[12.5px]">
            <thead><tr className="label-caps text-left"><th className="p-2">Prefix</th><th className="p-2">Label</th><th className="p-2">Env</th><th className="p-2">Uses</th><th className="p-2">Expires</th><th className="p-2">State</th><th /></tr></thead>
            <tbody>
              {tokens.data.map((t) => {
                const expired = new Date(t.expires_at) < new Date();
                const state = t.revoked_at ? "revoked" : expired ? "expired" : t.used_count >= t.max_uses ? "exhausted" : "active";
                return (
                  <tr key={t.id} className="border-t border-border">
                    <td className="p-2 font-mono">{t.token_prefix}…</td>
                    <td className="p-2">{t.label ?? "—"}</td>
                    <td className="p-2 font-mono">{t.environment}</td>
                    <td className="p-2 mono-num">{t.used_count}/{t.max_uses}</td>
                    <td className="p-2" title={exactTime(t.expires_at)}>{relativeTime(t.expires_at)}</td>
                    <td className={`p-2 font-mono ${state === "active" ? "text-ok" : "text-muted-foreground"}`}>{state}</td>
                    <td className="p-2 text-right">{state === "active" && <button className={btnDangerClass} onClick={() => revoke(t.id)}>Revoke</button>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Panel>
    </>
  );
}

function Roles({ isAdmin }: { isAdmin: boolean }) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["all-roles"],
    queryFn: async () => {
      const [{ data: roles, error }, { data: profiles }] = await Promise.all([
        supabase.from("user_roles").select("user_id,role"),
        supabase.from("profiles").select("*"),
      ]);
      if (error) throw error;
      const map = new Map<string, { id: string; email: string; roles: AppRole[] }>();
      for (const p of (profiles ?? []) as { id: string; email?: string | null; display_name?: string | null }[]) {
        map.set(p.id, { id: p.id, email: p.email ?? p.display_name ?? p.id.slice(0, 8), roles: [] });
      }
      for (const r of roles ?? []) {
        const e = map.get(r.user_id) ?? { id: r.user_id, email: r.user_id.slice(0, 8), roles: [] };
        e.roles.push(r.role as AppRole); map.set(r.user_id, e);
      }
      return [...map.values()];
    },
  });

  async function setRole(userId: string, role: AppRole) {
    await supabase.from("user_roles").delete().eq("user_id", userId);
    await supabase.from("user_roles").insert({ user_id: userId, role });
    qc.invalidateQueries();
  }

  return (
    <Panel title="Operators & roles">
      {q.isLoading ? <TableSkeleton rows={3} cols={2} /> : q.error ? <ErrorState message={(q.error as Error).message} /> : (
        <table className="w-full text-[12.5px]">
          <tbody>
            {(q.data ?? []).map((u) => (
              <tr key={u.id} className="border-t border-border first:border-t-0">
                <td className="p-2 font-mono">{u.email}</td>
                <td className="p-2 text-right">
                  {isAdmin ? (
                    <select className={`${inputClass} w-32`} value={u.roles.includes("admin") ? "admin" : u.roles.includes("operator") ? "operator" : "viewer"} onChange={(e) => setRole(u.id, e.target.value as AppRole)}>
                      <option value="viewer">viewer</option><option value="operator">operator</option><option value="admin">admin</option>
                    </select>
                  ) : <span className="font-mono text-muted-foreground">{u.roles.join(", ") || "viewer"}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Panel>
  );
}
