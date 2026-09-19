/**
 * Shared helpers for the agent-facing HTTP surface.
 * These endpoints are called by the Linux agent, not by the browser, so they
 * authenticate with enrollment tokens / per-node agent keys instead of a
 * Supabase user session.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function randomToken(bytes = 24): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return Array.from(buf)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  });
}

export function fail(message: string, status = 400, extra?: Record<string, unknown>): Response {
  return json({ error: message, ...extra }, status);
}

/** Constant-time-ish comparison for hex digests. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export type AuthedNode = { nodeId: string };

/**
 * Authenticates an agent request using `x-node-id` + `x-agent-key`.
 * Returns a Response when authentication fails so callers can return it directly.
 */
export async function authenticateNode(
  request: Request,
): Promise<{ node: AuthedNode } | { response: Response }> {
  const nodeId = request.headers.get("x-node-id");
  const agentKey = request.headers.get("x-agent-key");
  if (!nodeId || !agentKey) {
    return { response: fail("Missing x-node-id or x-agent-key", 401) };
  }
  if (!/^[0-9a-f-]{36}$/i.test(nodeId)) {
    return { response: fail("Malformed node id", 401) };
  }

  const { data, error } = await supabaseAdmin
    .from("node_secrets")
    .select("node_id,agent_key_hash")
    .eq("node_id", nodeId)
    .maybeSingle();

  if (error) return { response: fail("Authentication backend unavailable", 503) };
  if (!data) return { response: fail("Unknown node", 401) };

  const presented = await sha256Hex(agentKey);
  if (!safeEqual(presented, data.agent_key_hash)) {
    return { response: fail("Invalid agent key", 401) };
  }

  const { data: node } = await supabaseAdmin
    .from("nodes")
    .select("enabled")
    .eq("id", nodeId)
    .maybeSingle();
  if (node && node.enabled === false) {
    return { response: fail("Node disabled by an operator", 403) };
  }

  return { node: { nodeId } };
}

export async function audit(
  action: string,
  target_type: string | null,
  target_id: string | null,
  details: Record<string, unknown>,
  actor_label = "agent",
) {
  await supabaseAdmin.from("audit_logs").insert({
    action,
    actor_label,
    target_type,
    target_id,
    details: details as never,
  });
}

export async function parseJson<T>(request: Request): Promise<T | null> {
  try {
    return (await request.json()) as T;
  } catch {
    return null;
  }
}
