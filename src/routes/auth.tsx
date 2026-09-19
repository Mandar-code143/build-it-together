import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/useSession";
import { Field, inputClass, btnPrimaryClass } from "@/components/console/Primitives";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — FleetOps Control Plane" },
      { name: "description", content: "Authenticate to the FleetOps fleet management and observability console." },
      { property: "og:title", content: "Sign in — FleetOps Control Plane" },
      { property: "og:description", content: "Authenticate to the FleetOps fleet management and observability console." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const { session } = useSession();
  const navigate = useNavigate();

  useEffect(() => {
    if (session) navigate({ to: "/" });
  }, [session, navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/` },
        });
        if (error) throw error;
        setNotice("Account created. If confirmation is required, check your inbox, then sign in.");
        setMode("signin");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-background px-4">
      <div className="w-full max-w-sm space-y-4">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-sm border border-primary/50 bg-primary/15 font-mono text-sm font-semibold text-primary">
            F
          </span>
          <div className="leading-tight">
            <div className="text-[15px] font-semibold tracking-tight">FleetOps</div>
            <div className="font-mono text-[10.5px] text-muted-foreground">distributed fleet control plane</div>
          </div>
        </div>

        <form onSubmit={submit} className="panel space-y-3 p-4">
          <Field label="Operator email">
            <input
              className={inputClass}
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ops@example.com"
            />
          </Field>
          <Field label="Password">
            <input
              className={inputClass}
              type="password"
              required
              minLength={8}
              autoComplete={mode === "signup" ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </Field>

          {error && (
            <p className="rounded-sm border border-crit/40 bg-crit-soft px-2 py-1.5 text-[12px] text-crit">{error}</p>
          )}
          {notice && (
            <p className="rounded-sm border border-info/40 bg-info-soft px-2 py-1.5 text-[12px] text-info">{notice}</p>
          )}

          <button className={`${btnPrimaryClass} w-full justify-center`} disabled={busy}>
            {busy ? "working…" : mode === "signin" ? "Sign in" : "Create account"}
          </button>

          <button
            type="button"
            className="w-full text-[12px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            onClick={() => {
              setMode(mode === "signin" ? "signup" : "signin");
              setError(null);
            }}
          >
            {mode === "signin" ? "No account yet? Create one" : "Already enrolled? Sign in"}
          </button>
        </form>

        <p className="text-center font-mono text-[11px] text-muted-foreground">
          The first account created becomes fleet admin. Later accounts start read-only.
        </p>
      </div>
    </main>
  );
}
