import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ShieldCheck,
  KeyRound,
  Lock,
  Activity,
  AlertTriangle,
  Smartphone,
  Trash2,
  Loader2,
  Terminal,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RequireAuth } from "@/components/RequireAuth";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [{ title: "Dashboard — SecureAuth" }],
  }),
  component: () => (
    <RequireAuth>
      <Dashboard />
    </RequireAuth>
  ),
});

type PamLine = { phase: string; module: string; result: string; detail: string };

function Dashboard() {
  const { user, roles, isAdmin } = useAuth();
  const [mfaEnrolled, setMfaEnrolled] = useState(false);
  const [trustedCount, setTrustedCount] = useState(0);
  const [recentEvents, setRecentEvents] = useState<
    { event: string; severity: string; created_at: string }[]
  >([]);
  const [pam, setPam] = useState<PamLine[] | null>(null);
  const [pamLoading, setPamLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: totp }, { data: devices }, { data: events }] = await Promise.all([
        supabase.from("totp_secrets").select("enrolled").eq("user_id", user.id).maybeSingle(),
        supabase
          .from("trusted_devices")
          .select("id")
          .eq("user_id", user.id)
          .gt("expires_at", new Date().toISOString()),
        supabase
          .from("audit_logs")
          .select("event, severity, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(8),
      ]);
      setMfaEnrolled(!!totp?.enrolled);
      setTrustedCount(devices?.length ?? 0);
      setRecentEvents(events ?? []);
    })();
  }, [user]);

  const runPam = async () => {
    setPamLoading(true);
    const { data, error } = await supabase.functions.invoke("pam-authenticate", { body: {} });
    setPamLoading(false);
    if (error || !data?.transcript) {
      toast.error("PAM check failed");
      return;
    }
    setPam(data.transcript);
    toast.success("PAM stack executed");
  };

  const revokeTrustedDevices = async () => {
    if (!user) return;
    await supabase.from("trusted_devices").delete().eq("user_id", user.id);
    localStorage.removeItem(`trusted_${user.id}`);
    setTrustedCount(0);
    toast.success("All trusted devices revoked");
  };

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">Welcome back</p>
          <h1 className="text-3xl font-bold tracking-tight">{user?.email}</h1>
          <div className="mt-2 flex flex-wrap gap-2">
            {roles.map((r) => (
              <Badge key={r} variant={r === "admin" ? "default" : "outline"}>
                {r.toUpperCase()}
              </Badge>
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          {isAdmin && (
            <Button asChild variant="outline">
              <Link to="/admin">Admin panel</Link>
            </Button>
          )}
          <Button asChild>
            <Link to="/mfa">Manage MFA</Link>
          </Button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">MFA</div>
            <KeyRound className="h-4 w-4 text-primary" />
          </div>
          <div className="mt-2 text-2xl font-bold">
            {mfaEnrolled ? (
              <span className="text-success">Enabled</span>
            ) : (
              <span className="text-warning">Off</span>
            )}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">TOTP authenticator app</p>
        </Card>

        <Card className="border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">
              Trusted devices
            </div>
            <Smartphone className="h-4 w-4 text-primary" />
          </div>
          <div className="mt-2 text-2xl font-bold">{trustedCount}</div>
          <p className="mt-1 text-xs text-muted-foreground">Skip MFA for 30 days</p>
        </Card>

        <Card className="border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Role</div>
            <ShieldCheck className="h-4 w-4 text-primary" />
          </div>
          <div className="mt-2 text-2xl font-bold capitalize">{roles[0] ?? "user"}</div>
          <p className="mt-1 text-xs text-muted-foreground">RBAC access level</p>
        </Card>

        <Card className="border-border bg-card p-5">
          <div className="flex items-center justify-between">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">Events</div>
            <Activity className="h-4 w-4 text-primary" />
          </div>
          <div className="mt-2 text-2xl font-bold">{recentEvents.length}</div>
          <p className="mt-1 text-xs text-muted-foreground">Recent audit entries</p>
        </Card>
      </div>

      {/* Two columns */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {/* PAM simulation */}
        <Card className="border-border bg-card p-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Terminal className="h-4 w-4 text-primary" />
              <h2 className="font-semibold">OS / PAM stack simulation</h2>
            </div>
            <Button size="sm" onClick={runPam} disabled={pamLoading}>
              {pamLoading && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
              Run PAM
            </Button>
          </div>
          <p className="mb-3 text-xs text-muted-foreground">
            Simulates a Linux PAM authentication: <code className="text-primary">auth → account → session</code>{" "}
            phases. Inspects your real role, lockout state, MFA enrollment, and trusted devices.
          </p>
          <div className="rounded-lg border border-border bg-background/40 p-3 font-mono text-xs">
            {pam ? (
              pam.map((l, i) => (
                <div key={i} className="flex items-start gap-2 py-0.5">
                  <span
                    className={
                      l.result === "PASS"
                        ? "text-success"
                        : l.result === "FAIL"
                          ? "text-destructive"
                          : "text-warning"
                    }
                  >
                    [{l.result}]
                  </span>
                  <span className="text-muted-foreground">{l.phase}</span>
                  <span className="text-primary">{l.module}</span>
                  <span className="text-foreground">{l.detail}</span>
                </div>
              ))
            ) : (
              <p className="text-muted-foreground">$ Click "Run PAM" to execute the stack</p>
            )}
          </div>
        </Card>

        {/* Recent events */}
        <Card className="border-border bg-card p-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-primary" />
              <h2 className="font-semibold">Your recent security events</h2>
            </div>
          </div>
          <div className="space-y-2">
            {recentEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">No events yet.</p>
            ) : (
              recentEvents.map((ev, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-md border border-border bg-background/30 px-3 py-2 text-sm"
                >
                  <div className="flex items-center gap-2">
                    {ev.severity === "warning" || ev.severity === "critical" ? (
                      <AlertTriangle className="h-3.5 w-3.5 text-warning" />
                    ) : (
                      <ShieldCheck className="h-3.5 w-3.5 text-success" />
                    )}
                    <span className="font-mono text-xs">{ev.event}</span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(ev.created_at).toLocaleString()}
                  </span>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>

      {/* Account actions */}
      <Card className="mt-6 border-border bg-card p-6">
        <div className="mb-4 flex items-center gap-2">
          <Lock className="h-4 w-4 text-primary" />
          <h2 className="font-semibold">Account security</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Button asChild variant="outline">
            <Link to="/forgot-password">Change password</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/mfa">{mfaEnrolled ? "Manage MFA" : "Enable MFA"}</Link>
          </Button>
          <Button variant="outline" onClick={revokeTrustedDevices} disabled={trustedCount === 0}>
            <Trash2 className="mr-2 h-4 w-4" />
            Revoke trusted devices
          </Button>
        </div>
      </Card>
    </main>
  );
}
