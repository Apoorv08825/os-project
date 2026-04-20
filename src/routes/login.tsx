import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { emailSchema } from "@/lib/password";
import { z } from "zod";
import { logAudit } from "@/lib/audit";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — SecureAuth" },
      { name: "description", content: "Sign in to SecureAuth." },
    ],
  }),
  component: Login,
});

const schema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Required").max(128),
});

function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }

    setLoading(true);
    // Pre-check lockout status
    try {
      const lockoutRes = await supabase.functions.invoke("check-lockout", {
        body: { email: parsed.data.email },
      });
      if (lockoutRes.data?.locked) {
        setLoading(false);
        toast.error(
          `Account temporarily locked. Try again in ${lockoutRes.data.minutes_remaining} minutes.`
        );
        return;
      }
    } catch {
      // continue if check fails
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });

    if (error) {
      // Record failure — wrapped in try-catch so CORS/missing edge-function
      // never blocks the loading state or error toast
      try {
        await supabase.functions.invoke("record-failed-login", {
          body: { email: parsed.data.email },
        });
      } catch {
        // non-critical — continue
      }
      setLoading(false);
      toast.error("Invalid credentials");
      return;
    }

    // Check if MFA is enrolled — if so, route to /mfa challenge
    const { data: totp } = await supabase
      .from("totp_secrets")
      .select("enrolled")
      .eq("user_id", data.user.id)
      .maybeSingle();

    setLoading(false);

    if (totp?.enrolled) {
      // Check trusted device cookie
      const trusted = localStorage.getItem(`trusted_${data.user.id}`);
      if (trusted) {
        await logAudit("login_success", { metadata: { trusted_device: true } });
        toast.success("Welcome back (trusted device)");
        navigate({ to: "/dashboard" });
        return;
      }
      navigate({ to: "/mfa-challenge" });
      return;
    }

    await logAudit("login_success");
    toast.success("Signed in");
    navigate({ to: "/dashboard" });
  };

  return (
    <main className="grid-pattern flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md border-border bg-card p-8 shadow-card-cyber">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-cyber shadow-glow">
            <LogIn className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Sign in</h1>
            <p className="text-xs text-muted-foreground">Authenticate with credentials</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              maxLength={254}
              autoComplete="email"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <Link to="/forgot-password" className="text-xs text-primary hover:underline">
                Forgot?
              </Link>
            </div>
            <div className="relative">
              <Input
                id="password"
                type={show ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                maxLength={128}
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground"
                aria-label="Toggle password visibility"
              >
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <Button type="submit" className="w-full shadow-glow" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Sign in
          </Button>
        </form>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          New here?{" "}
          <Link to="/signup" className="text-primary hover:underline">
            Create an account
          </Link>
        </p>
      </Card>
    </main>
  );
}
