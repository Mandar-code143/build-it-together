import type { ReactNode } from "react";
import { toneClasses, utilisationTone, pct } from "@/lib/fleet";

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-3 border-b border-border pb-3">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-0.5 text-[12.5px] text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function Panel({
  title,
  right,
  children,
  className = "",
}: {
  title?: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      {title && (
        <div className="panel-header">
          <h2 className="label-caps">{title}</h2>
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

export function MetricBar({
  label,
  value,
  detail,
}: {
  label: string;
  value: number | null | undefined;
  detail?: string;
}) {
  const tone = toneClasses(utilisationTone(value));
  const width = Math.min(100, Math.max(0, Number(value ?? 0)));
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between">
        <span className="label-caps">{label}</span>
        <span className={`mono-num ${value == null ? "text-muted-foreground" : tone.text}`}>{pct(value)}</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-sm bg-muted">
        <div className={`h-full ${tone.bar} transition-[width] duration-500`} style={{ width: `${width}%` }} />
      </div>
      {detail && <p className="mono-num text-[11px] text-muted-foreground">{detail}</p>}
    </div>
  );
}

export function StatTile({
  label,
  value,
  hint,
  tone = "idle",
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: "ok" | "warn" | "crit" | "info" | "idle";
}) {
  const t = toneClasses(tone);
  return (
    <div className="panel px-3 py-2.5">
      <div className="label-caps">{label}</div>
      <div className={`mt-1 font-mono text-2xl leading-none tabular-nums ${t.text}`}>{value}</div>
      {hint && <div className="mt-1 text-[11.5px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      <div className="scanline h-4 w-24 opacity-60" aria-hidden />
      <p className="text-sm font-medium">{title}</p>
      {hint && <p className="max-w-md text-[12.5px] text-muted-foreground">{hint}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ message }: { message: string }) {
  return (
    <div className="m-3 rounded-sm border border-crit/40 bg-crit-soft px-3 py-2 text-[12.5px] text-crit">
      {message}
    </div>
  );
}

export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="divide-y divide-border">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4 px-3 py-2.5">
          {Array.from({ length: cols }).map((__, c) => (
            <div
              key={c}
              className="h-3 animate-pulse rounded-sm bg-muted"
              style={{ width: `${[22, 12, 14, 10, 16, 12][c % 6]}%` }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

export function CodeBlock({ children, label }: { children: string; label?: string }) {
  return (
    <div className="overflow-hidden rounded-sm border border-border bg-rail">
      {label && <div className="label-caps border-b border-border px-2.5 py-1.5">{label}</div>}
      <pre className="max-h-72 overflow-auto px-2.5 py-2 font-mono text-[11.5px] leading-relaxed text-foreground/90">
        {children}
      </pre>
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="label-caps">{label}</span>
      {children}
    </label>
  );
}

export const inputClass =
  "w-full rounded-sm border border-input bg-rail px-2 py-1.5 font-mono text-[12.5px] text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none";

export const btnClass =
  "inline-flex items-center gap-1.5 rounded-sm border border-border bg-surface-raised px-2.5 py-1.5 text-[12.5px] font-medium text-foreground transition-colors hover:border-ring/60 hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50";

export const btnPrimaryClass =
  "inline-flex items-center gap-1.5 rounded-sm border border-primary/60 bg-primary/15 px-2.5 py-1.5 text-[12.5px] font-medium text-primary transition-colors hover:bg-primary/25 disabled:cursor-not-allowed disabled:opacity-50";

export const btnDangerClass =
  "inline-flex items-center gap-1.5 rounded-sm border border-crit/50 bg-crit-soft px-2.5 py-1.5 text-[12.5px] font-medium text-crit transition-colors hover:bg-crit/20 disabled:cursor-not-allowed disabled:opacity-50";
