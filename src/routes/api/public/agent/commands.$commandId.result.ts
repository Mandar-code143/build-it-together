import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const Body = z.object({
  status: z.enum(["running", "succeeded", "failed", "timed_out", "rejected"]),
  exit_code: z.number().int().nullable().optional(),
  stdout: z.string().max(65536).optional(),
  stderr: z.string().max(65536).optional(),
  error: z.string().max(2000).optional(),
  duration_ms: z.number().int().min(0).optional(),
});

export const Route = createFileRoute("/api/public/agent/commands/$commandId/result")({
  server: {
    handlers: {
      POST: async ({ request, params }) => {
        const api = await import("@/lib/agent-api.server");
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const auth = await api.authenticateNode(request);
        if ("response" in auth) return auth.response;
        if (!/^[0-9a-f-]{36}$/i.test(params.commandId)) return api.fail("Bad command id", 400);
        const parsed = Body.safeParse(await api.parseJson(request));
        if (!parsed.success) return api.fail("Invalid result payload", 400, { issues: parsed.error.issues });

        const { data: cmd } = await supabaseAdmin.from("commands")
          .select("id,node_id,status,action").eq("id", params.commandId).maybeSingle();
        if (!cmd || cmd.node_id !== auth.node.nodeId) return api.fail("Unknown command", 404);
        const terminal = ["succeeded", "failed", "timed_out", "cancelled", "rejected"];
        if (terminal.includes(cmd.status)) return api.json({ ok: true, duplicate: true }); // idempotent

        const b = parsed.data;
        const now = new Date().toISOString();
        await supabaseAdmin.from("commands").update(
          b.status === "running"
            ? { status: "running", started_at: now }
            : {
                status: b.status, finished_at: now, exit_code: b.exit_code ?? null,
                stdout: b.stdout ?? null, stderr: b.stderr ?? null, error: b.error ?? null,
                duration_ms: b.duration_ms ?? null,
              },
        ).eq("id", cmd.id);
        if (b.status !== "running") {
          await api.audit("command.completed", "command", cmd.id, { action: cmd.action, status: b.status, exit_code: b.exit_code ?? null });
        }
        return api.json({ ok: true });
      },
    },
  },
});
