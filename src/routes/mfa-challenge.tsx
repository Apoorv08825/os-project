import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import * as OTPAuth from "otpauth";
import { Loader2, KeyRound, ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { RequireAuth } from "@/components/RequireAuth";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/audit";

export const Route = createFileRoute("/mfa-challenge")({
  head: () => ({ meta: [{ title: "MFA — SecureAuth" }] }),
  component: () => (
    <RequireAuth>
      <MfaChallenge />
    </RequireAuth>
  ),
});

async function sha256Hex(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function MfaChallenge() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [code, setCode] = useState("");
  const [trust, setTrust] = useState(false);
  const [loading, setLoading] = useState(false);
  const [useBackup, setUseBackup] = useState(false);

  const verify = async () => {
    if (!user) return;
    setLoading(true);

    if (useBackup) {
      // Verify backup code
      const hash = await sha256Hex(code.toUpperCase().trim());
      const { data: rows } = await supabase
        .from("backup_codes")
        .select("id, used")
        .eq("user_id", user.id)
        .eq("code_hash", hash)
        .limit(1);
      const row = rows?.[0];
      if (!row || row.used) {
        await logAudit("mfa_failed", { severity: "warning", metadata: { factor: "backup_code" } });
        setLoading(false);
        toast.error("Invalid or already-used backup code");
        return;
      }
      await supabase
        .from("backup_codes")
        .update({ used: true, used_at: new Date().toISOString() })
        .eq("id", row.id);
      await logAudit("backup_code_used", { severity: "warning" });
    } else {
      // Verify TOTP
      const { data: secret } = await supabase
        .from("totp_secrets")
        .select("secret")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!secret) {
        setLoading(false);
        toast.error("MFA not configured");
        return;
      }
      const totp = new OTPAuth.TOTP({
        issuer: "SecureAuth",
        label: user.email!,
        secret: OTPAuth.Secret.fromBase32(secret.secret),
      });
      const ok = totp.validate({ token: code, window: 1 });
      if (ok === null) {
        await logAudit("mfa_failed", { severity: "warning", metadata: { factor: "totp" } });
        setLoading(false);
        toast.error("Incorrect code");
        return;
      }
      await logAudit("mfa_verified", { metadata: { factor: "totp" } });
    }

    if (trust) {
      // Create a trusted device entry valid for 30 days
      const tokenBytes = new Uint8Array(32);
      crypto.getRandomValues(tokenBytes);
      const token = Array.from(tokenBytes)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      const tokenHash = await sha256Hex(token);
      const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      await supabase.from("trusted_devices").insert({
        user_id: user.id,
        device_token_hash: tokenHash,
        device_label: navigator.userAgent.slice(0, 60),
        user_agent: navigator.userAgent.slice(0, 255),
        expires_at: expires,
      });
      localStorage.setItem(`trusted_${user.id}`, token);
      await logAudit("trusted_device_added");
    }

    await logAudit("login_success", { metadata: { mfa_used: true } });
    setLoading(false);
    toast.success("Welcome back");
    navigate({ to: "/dashboard" });
  };

  return (
    <main className="grid-pattern flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md border-border bg-card p-8 shadow-card-cyber">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyber shadow-glow">
            <ShieldCheck className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Verify it's you</h1>
            <p className="text-xs text-muted-foreground">Step 2 — second factor</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="code">
              {useBackup ? "Backup code" : "Authenticator code"}
            </Label>
            <Input
              id="code"
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value)}
              maxLength={useBackup ? 11 : 6}
              inputMode={useBackup ? "text" : "numeric"}
              className="font-mono text-lg tracking-widest"
              placeholder={useBackup ? "ABCDE-12345" : "123456"}
            />
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="trust"
              checked={trust}
              onCheckedChange={(v) => setTrust(!!v)}
            />
            <Label htmlFor="trust" className="text-sm font-normal text-muted-foreground">
              Trust this device for 30 days
            </Label>
          </div>

          <Button onClick={verify} disabled={loading || !code} className="w-full shadow-glow">
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <KeyRound className="mr-2 h-4 w-4" />
            Verify
          </Button>

          <div className="flex justify-between text-xs">
            <button
              onClick={() => {
                setUseBackup((v) => !v);
                setCode("");
              }}
              className="text-primary hover:underline"
            >
              {useBackup ? "Use authenticator instead" : "Use a backup code"}
            </button>
            <button
              onClick={async () => {
                await signOut();
                navigate({ to: "/login" });
              }}
              className="text-muted-foreground hover:text-foreground"
            >
              Cancel & sign out
            </button>
          </div>
        </div>
      </Card>
    </main>
  );
}
