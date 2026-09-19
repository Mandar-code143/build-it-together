import { useEffect, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useSession } from "@/hooks/useSession";
import { Shell } from "./Shell";

export function Console({ children }: { children: ReactNode }) {
  const { session, loading } = useSession();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !session) navigate({ to: "/auth" });
  }, [loading, session, navigate]);

  if (loading || !session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="space-y-2 text-center">
          <div className="scanline mx-auto h-4 w-32 opacity-70" aria-hidden />
          <p className="font-mono text-[12px] text-muted-foreground">
            {loading ? "establishing session…" : "redirecting to sign in…"}
          </p>
        </div>
      </div>
    );
  }

  return <Shell>{children}</Shell>;
}
