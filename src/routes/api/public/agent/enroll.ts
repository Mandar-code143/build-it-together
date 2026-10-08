import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const Body = z.object({
  token: z.string().min(16).max(200),
  hostname: z.string().min(1).max(253),
  address: z.string().max(100).optional(),
  os: z.string().max(100).optional(),
  os_version: z.string().max(100).optional(),
  kernel: z.string().max(200).optional(),
  architecture: z.string().max(50).optional(),
  agent_version: z.string().max(50).optional(),
  protocol_version: z.string().max(20).optional(),
  fingerprint: z.string().max(200).optional(),
  boot_time: z.string().max(50).optional(),
  node_exporter_port: z.number().int().min(1).max(65535).optional(),
  capabilities: z.array(z.string().max(64)).max(50).optional(),
  labels: z.record(z.string().max(64), z.string().max(200)).optional(),
});

export const Route = createFileRoute("/api/public/agent/enroll")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const api = await import("@/lib/agent-api.server");
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const raw = await api.parseJson(request);
        const parsed = Body.safeParse(raw);
        if (!parsed.success) return api.fail("Invalid enrollment payload", 400, { issues: parsed.error.issues });
        const b = parsed.data;

        const hash = await api.sha256Hex(b.token);
        const { data: tok } = await supabaseAdmin
          .from("enrollment_tokens").select("*").eq("token_hash", hash).maybeSingle();
        if (!tok) return api.fail("Invalid enrollment token", 401);
        if (tok.revoked_at) return api.fail("Enrollment token revoked", 401);
        if (new Date(tok.expires_at) < new Date()) return api.fail("Enrollment token expired", 401);
        if (tok.used_count >= tok.max_uses) return api.fail("Enrollment token exhausted", 401);

        // Re-enrollment of the same fingerprint reuses the node record (idempotent).
        let nodeId: string | null = null;
        if (b.fingerprint) {
          const { data: existing } = await supabaseAdmin
            .from("nodes").select("id").eq("fingerprint", b.fingerprint).maybeSingle();
          nodeId = existing?.id ?? null;
        }
        const fields = {
          hostname: b.hostname,
          address: b.address ?? null,
          os: b.os ?? null,
          os_version: b.os_version ?? null,
          kernel: b.kernel ?? null,
          architecture: b.architecture ?? null,
          agent_version: b.agent_version ?? null,
          protocol_version: b.protocol_version ?? "1",
          fingerprint: b.fingerprint ?? null,
          boot_time: b.boot_time ?? null,
          node_exporter_port: b.node_exporter_port ?? 9100,
          capabilities: (b.capabilities ?? []) as never,
          labels: (b.labels ?? {}) as never,
          environment: tok.environment,
          group_id: tok.group_id,
          status: "online" as const,
          last_heartbeat_at: new Date().toISOString(),
        };
        if (nodeId) {
          const { error } = await supabaseAdmin.from("nodes").update(fields).eq("id", nodeId);
          if (error) return api.fail("Could not update node", 500);
        } else {
          const { data, error } = await supabaseAdmin.from("nodes").insert(fields).select("id").single();
          if (error || !data) return api.fail("Could not register node", 500);
          nodeId = data.id;
        }

        const agentKey = api.randomToken(32);
        const keyHash = await api.sha256Hex(agentKey);
        const { error: sErr } = await supabaseAdmin
          .from("node_secrets")
          .upsert({ node_id: nodeId, agent_key_hash: keyHash, rotated_at: new Date().toISOString() });
        if (sErr) return api.fail("Could not store agent credentials", 500);

        await supabaseAdmin.from("enrollment_tokens").update({ used_count: tok.used_count + 1 }).eq("id", tok.id);
        await api.audit("node.enrolled", "node", nodeId, { hostname: b.hostname, token_prefix: tok.token_prefix, reenrolled: !!b.fingerprint });

        return api.json({ node_id: nodeId, agent_key: agentKey, heartbeat_interval_seconds: 15, protocol_version: "1" }, 201);
      },
    },
  },
});
