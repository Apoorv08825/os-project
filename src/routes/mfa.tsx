import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import * as OTPAuth from "otpauth";
import QRCode from "qrcode";
import { Loader2, KeyRound, Copy, CheckCheck, Trash2, Mail, Smartphone } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { RequireAuth } from "@/components/RequireAuth";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/audit";

export const Route = createFileRoute("/mfa")({
  head: () => ({ meta: [{ title: "MFA — SecureAuth" }] }),
  component: () => (
    <RequireAuth>
      <MfaPage />
    </RequireAuth>
  ),
});

function generateBackupCodes(n = 10): string[] {
  const codes: string[] = [];
  for (let i = 0; i < n; i++) {
    const bytes = new Uint8Array(5);
    crypto.getRandomValues(bytes);
    const hex = Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase();
    codes.push(`${hex.slice(0, 5)}-${hex.slice(5, 10)}`);
  }
  return codes;
}

async function sha256Hex(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function MfaPage() {
  const { user } = useAuth();
  const [enrolled, setEnrolled] = useState(false);
  const [pendingSecret, setPendingSecret] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [backupCodes, setBackupCodes] = useState<string[] | null>(null);
  const [copied, setCopied] = useState(false);

  // email otp
  const [demoCode, setDemoCode] = useState<string | null>(null);
  const [emailCode, setEmailCode] = useState("");
  const [emailLoading, setEmailLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("totp_secrets")
      .select("enrolled")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => setEnrolled(!!data?.enrolled));
  }, [user]);

  const startEnroll = async () => {
    if (!user) return;
    const secret = new OTPAuth.Secret({ size: 20 });
    const totp = new OTPAuth.TOTP({
      issuer: "SecureAuth",
      label: user.email!,
      algorithm: "SHA1",
      digits: 6,
      period: 30,
      secret,
    });
    const uri = totp.toString();
    const qr = await QRCode.toDataURL(uri, { margin: 1, width: 220 });
    setPendingSecret(secret.base32);
    setQrDataUrl(qr);

    // upsert (not yet enrolled)
    await supabase
      .from("totp_secrets")
      .upsert({ user_id: user.id, secret: secret.base32, enrolled: false });
  };

  const confirmEnroll = async () => {
    if (!user || !pendingSecret) return;
    if (!/^\d{6}$/.test(code)) {
      toast.error("Enter the 6-digit code from your app");
      return;
    }
    setLoading(true);
    const totp = new OTPAuth.TOTP({
      issuer: "SecureAuth",
      label: user.email!,
      secret: OTPAuth.Secret.fromBase32(pendingSecret),
    });
    const delta = totp.validate({ token: code, window: 1 });
    if (delta === null) {
      setLoading(false);
      toast.error("Code incorrect — check your authenticator app");
      return;
    }

    await supabase.from("totp_secrets").update({ enrolled: true }).eq("user_id", user.id);

    // Generate backup codes
    const codes = generateBackupCodes(10);
    const hashed = await Promise.all(
      codes.map(async (c) => ({
        user_id: user.id,
        code_hash: await sha256Hex(c),
      }))
    );
    await supabase.from("backup_codes").delete().eq("user_id", user.id);
    await supabase.from("backup_codes").insert(hashed);

    await logAudit("mfa_enrolled", { metadata: { factor: "totp" } });

    setEnrolled(true);
    setBackupCodes(codes);
    setPendingSecret(null);
    setQrDataUrl(null);
    setCode("");
    setLoading(false);
    toast.success("TOTP enrolled. Save your backup codes.");
  };

  const disableMfa = async () => {
    if (!user) return;
    if (!confirm("Disable MFA? Your account will be less secure.")) return;
    await supabase.from("totp_secrets").delete().eq("user_id", user.id);
    await supabase.from("backup_codes").delete().eq("user_id", user.id);
    await logAudit("mfa_disabled", { severity: "warning" });
    setEnrolled(false);
    setBackupCodes(null);
    toast.success("MFA disabled");
  };

  const copyBackupCodes = () => {
    if (!backupCodes) return;
    navigator.clipboard.writeText(backupCodes.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Email OTP demo
  const sendEmailOtp = async () => {
    setEmailLoading(true);
    setDemoCode(null);
    const { data, error } = await supabase.functions.invoke("send-email-otp", { body: {} });
    setEmailLoading(false);
    if (error || !data?.ok) {
      toast.error("Failed to send code");
      return;
    }
    setDemoCode(data.demo_code);
    toast.success("Email OTP sent (see demo card)");
  };

  const verifyEmailOtp = async () => {
    setEmailLoading(true);
    const { data, error } = await supabase.functions.invoke("verify-email-otp", {
      body: { code: emailCode },
    });
    setEmailLoading(false);
    if (error || !data?.ok) {
      toast.error(`Verification failed: ${data?.reason ?? "error"}`);
      return;
    }
    toast.success("Email OTP verified");
    setDemoCode(null);
    setEmailCode("");
  };

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Multi-Factor Authentication</h1>
        <p className="mt-2 text-muted-foreground">
          Add an extra layer of security with TOTP, email OTP, and backup codes.
        </p>
      </div>

      {/* TOTP */}
      <Card className="border-border bg-card p-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Smartphone className="h-5 w-5 text-primary" />
            <h2 className="font-semibold">Authenticator app (TOTP)</h2>
          </div>
          {enrolled ? (
            <Badge className="bg-success text-success-foreground">Enrolled</Badge>
          ) : (
            <Badge variant="outline">Not set up</Badge>
          )}
        </div>

        {enrolled && !backupCodes && (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              TOTP is active. Codes are required at sign-in (unless on a trusted device).
            </p>
            <Button variant="destructive" size="sm" onClick={disableMfa}>
              <Trash2 className="mr-2 h-4 w-4" />
              Disable MFA
            </Button>
          </div>
        )}

        {!enrolled && !pendingSecret && (
          <Button onClick={startEnroll} className="shadow-glow">
            <KeyRound className="mr-2 h-4 w-4" />
            Begin enrollment
          </Button>
        )}

        {pendingSecret && qrDataUrl && (
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <p className="mb-3 text-sm">
                <span className="font-semibold">Step 1.</span> Scan with Google Authenticator,
                Authy, 1Password, or any TOTP app.
              </p>
              <div className="inline-block rounded-lg bg-white p-2">
                <img src={qrDataUrl} alt="TOTP QR code" className="h-44 w-44" />
              </div>
              <p className="mt-3 text-xs text-muted-foreground">
                Or enter manually:{" "}
                <code className="break-all rounded bg-secondary px-1.5 py-0.5 text-foreground">
                  {pendingSecret}
                </code>
              </p>
            </div>
            <div>
              <p className="mb-3 text-sm">
                <span className="font-semibold">Step 2.</span> Enter the current 6-digit code from
                your app.
              </p>
              <Label htmlFor="code">Verification code</Label>
              <Input
                id="code"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                className="mt-1 font-mono text-lg tracking-widest"
                placeholder="123456"
              />
              <Button
                onClick={confirmEnroll}
                disabled={loading || code.length !== 6}
                className="mt-3 w-full"
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirm & enroll
              </Button>
            </div>
          </div>
        )}

        {backupCodes && (
          <div className="mt-4 rounded-lg border border-warning/40 bg-warning/5 p-4">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-semibold text-warning">Save your backup codes</h3>
              <Button variant="ghost" size="sm" onClick={copyBackupCodes}>
                {copied ? (
                  <>
                    <CheckCheck className="mr-1 h-3.5 w-3.5" /> Copied
                  </>
                ) : (
                  <>
                    <Copy className="mr-1 h-3.5 w-3.5" /> Copy all
                  </>
                )}
              </Button>
            </div>
            <p className="mb-3 text-xs text-muted-foreground">
              Each code works once. Use them if you lose access to your authenticator. They are
              hashed in our database — this is your only chance to see them.
            </p>
            <div className="grid grid-cols-2 gap-2 font-mono text-sm">
              {backupCodes.map((c) => (
                <div key={c} className="rounded bg-background/60 px-3 py-1.5">
                  {c}
                </div>
              ))}
            </div>
            <Button variant="outline" size="sm" onClick={() => setBackupCodes(null)} className="mt-3">
              I've saved them
            </Button>
          </div>
        )}
      </Card>

      {/* Email OTP */}
      <Card className="mt-6 border-border bg-card p-6">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            <h2 className="font-semibold">Email OTP (test)</h2>
          </div>
          <Badge variant="outline">Demo</Badge>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">
          Sends a 6-digit code with 5-minute expiry. In this demo the code appears below; in
          production it would be emailed.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <Button onClick={sendEmailOtp} disabled={emailLoading} variant="outline">
            {emailLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Send code
          </Button>
          {demoCode && (
            <div className="rounded-lg border border-primary/40 bg-primary/5 px-3 py-2 text-sm">
              <span className="text-muted-foreground">Demo code:</span>{" "}
              <code className="font-mono text-base font-bold text-primary">{demoCode}</code>
            </div>
          )}
        </div>
        {demoCode && (
          <div className="mt-4 flex items-end gap-3">
            <div className="flex-1">
              <Label htmlFor="emailCode">Enter the code</Label>
              <Input
                id="emailCode"
                inputMode="numeric"
                maxLength={6}
                value={emailCode}
                onChange={(e) => setEmailCode(e.target.value.replace(/\D/g, ""))}
                className="mt-1 font-mono"
              />
            </div>
            <Button onClick={verifyEmailOtp} disabled={emailLoading || emailCode.length !== 6}>
              Verify
            </Button>
          </div>
        )}
      </Card>
    </main>
  );
}
