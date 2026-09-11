import { NODE_STATUS_META, COMMAND_STATUS_META, toneClasses, relativeTime, exactTime } from "@/lib/fleet";
import type { CommandStatus, NodeStatus } from "@/lib/fleet";

/** Status is never conveyed by color alone: glyph + label + color + timestamp. */
export function NodeStatusBadge({
  status,
  since,
  compact = false,
}: {
  status: NodeStatus;
  since?: string | null;
  compact?: boolean;
}) {
  const meta = NODE_STATUS_META[status];
  const tone = toneClasses(meta.tone);
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-sm border px-1.5 py-0.5 ${tone.bg} ${tone.border} ${tone.text}`}
      title={since ? `${meta.description} · last heartbeat ${exactTime(since)}` : meta.description}
    >
      <span aria-hidden className="font-mono text-[10px] leading-none">
        {meta.glyph}
      </span>
      <span className="text-[11px] font-medium tracking-wide">{meta.label}</span>
      {!compact && since !== undefined && (
        <span className="mono-num text-[10.5px] text-muted-foreground">{relativeTime(since)}</span>
      )}
    </span>
  );
}

export function CommandStatusBadge({ status }: { status: CommandStatus }) {
  const meta = COMMAND_STATUS_META[status];
  const tone = toneClasses(meta.tone);
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-sm border px-1.5 py-0.5 ${tone.bg} ${tone.border} ${tone.text}`}>
      <span className="text-[11px] font-medium">{meta.label}</span>
    </span>
  );
}

export function SeverityBadge({ severity }: { severity: string }) {
  const tone = toneClasses(severity === "critical" ? "crit" : severity === "warning" ? "warn" : "info");
  return (
    <span className={`inline-flex rounded-sm border px-1.5 py-0.5 text-[11px] font-medium uppercase tracking-wide ${tone.bg} ${tone.border} ${tone.text}`}>
      {severity}
    </span>
  );
}
