import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Console } from "@/components/console/AuthGate";
import { PageHeader, Panel, EmptyState, ErrorState, TableSkeleton, inputClass } from "@/components/console/Primitives";
import { exactTime, relativeTime } from "@/lib/fleet";
import type { AuditRow } from "@/lib/fleet";

export const Route = createFileRoute("/audit")({
  head: () => ({
    meta: [
      { title: "Audit trail — FleetOps" },
      { name: "description", content: "Append-only record of enrollments, command issuance, results and configuration changes." },
      { property: "og:title", content: "Audit trail — FleetOps" },
      { property: "og:description", content: "Append-only record of enrollments, command issuance, results and configuration changes." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: () => (
    <Console>
      <AuditPage />
    </Console>
  ),
});

function AuditPage() {
  const [q, setQ] = useState("");

  const logs = useQuery({
    queryKey: ["audit"],
    refetchInterval: 15000,
    queryFn: async () => {
      const { data, error } = await supabase.from("audit_logs").select("*").order("occurred_at", { ascending: false }).limit(300);
      if (error) throw error;
      return (data ?? []) as AuditRow[];
    },
  });

  const rows = (logs.data ?? []).filter((r) =>
    q ? `${r.action} ${r.actor_label ?? ""} ${r.target_type ?? ""} ${JSON.stringify(r.details)}`.toLowerCase().includes(q.toLowerCase()) : true,
  );

  return (
    <>
      <PageHeader
        title="Audit trail"
        subtitle="Append-only. Rows cannot be edited or deleted from the console."
        actions={
          <input
            className={`${inputClass} w-64`}
            placeholder="filter action / actor / payload"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Filter audit log"
          />
        }
      />

      <Panel title={`Entries · ${rows.length}`}>
        {logs.isLoading ? (
          <TableSkeleton cols={5} />
        ) : logs.error ? (
          <ErrorState message={(logs.error as Error).message} />
        ) : rows.length === 0 ? (
          <EmptyState title="No audit entries" hint="Enrollments, command issuance and results are recorded here automatically." />
        ) : (
          <div className="overflow-x-auto">
            <table className="console-table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Action</th>
                  <th>Actor</th>
                  <th>Target</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="mono-num text-muted-foreground" title={exactTime(r.occurred_at)}>
                      {relativeTime(r.occurred_at)}
                    </td>
                    <td className="font-mono text-[12.5px]">{r.action}</td>
                    <td className="text-[12px]">{r.actor_label ?? "system"}</td>
                    <td className="font-mono text-[11.5px] text-muted-foreground">
                      {r.target_type ?? "—"}
                      {r.target_id ? ` / ${r.target_id.slice(0, 8)}` : ""}
                    </td>
                    <td className="max-w-md truncate font-mono text-[11.5px] text-muted-foreground" title={JSON.stringify(r.details)}>
                      {JSON.stringify(r.details)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </>
  );
}
