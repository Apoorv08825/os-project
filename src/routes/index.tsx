import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Shield,
  KeyRound,
  Lock,
  Activity,
  Fingerprint,
  AlertTriangle,
  CheckCircle2,
  Server,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SecureAuth — Production-grade auth framework" },
      {
        name: "description",
        content:
          "Multi-factor auth, RBAC, password history, audit logs, and integrity checks. Built on OWASP best practices.",
      },
    ],
  }),
  component: Home,
});

const features = [
  {
    icon: KeyRound,
    title: "Multi-Factor Authentication",
    desc: "TOTP (Google Authenticator), email OTP, 10 single-use backup codes, and trusted-device fingerprinting.",
  },
  {
    icon: Lock,
    title: "Secure Password Management",
    desc: "Argon2/bcrypt hashing, strength meter, history (no reuse of last 5), policy enforcement, secure reset.",
  },
  {
    icon: Shield,
    title: "RBAC + RLS",
    desc: "Separate user_roles table with security-definer functions. Zero privilege-escalation surface.",
  },
  {
    icon: Activity,
    title: "Live Audit Logging",
    desc: "Every login, MFA event, password change, and role grant is recorded and searchable.",
  },
  {
    icon: AlertTriangle,
    title: "Brute-Force Protection",
    desc: "Failed-login tracking with soft account lockout (5 fails → 15 min). Suspicious-IP detection.",
  },
  {
    icon: Fingerprint,
    title: "Trapdoor Detection",
    desc: "Code-audit scanner for hardcoded secrets. SHA-256 integrity check on critical edge functions.",
  },
];

const protections = [
  { name: "SQL Injection", how: "Parameterized queries via Supabase client (no string concat)" },
  { name: "XSS", how: "React auto-escapes; no dangerouslySetInnerHTML; input sanitization" },
  { name: "CSRF", how: "Bearer tokens in headers (not cookies); SameSite policy" },
  { name: "Buffer Overflow", how: "Zod schemas with max-length caps on every input" },
  { name: "Privilege Escalation", how: "Roles in separate table; SECURITY DEFINER has_role()" },
  { name: "Brute Force", how: "Failed-login tracking + 15-minute lockout window" },
  { name: "Session Hijacking", how: "JWT + auto-refresh; trusted device tokens hashed" },
  { name: "Hardcoded Backdoors", how: "Static code-audit module scans every commit" },
];

function Home() {
  return (
    <main className="grid-pattern">
      {/* Hero */}
      <section className="relative overflow-hidden border-b border-border">
        <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
          <div className="mx-auto max-w-3xl text-center">
            <Badge variant="outline" className="border-primary/40 text-primary">
              <Shield className="mr-1 h-3 w-3" /> OWASP-aligned · Production-ready
            </Badge>
            <h1 className="mt-6 text-5xl font-bold tracking-tight sm:text-6xl">
              Secure Authentication Framework for{" "}
              <span className="text-cyber">Operating Systems</span>
            </h1>
            <p className="mt-6 text-lg text-muted-foreground">
              MFA · RBAC · password history · audit logging · integrity checks · brute-force
              protection. Everything you need to ship a hardened login layer.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button size="lg" asChild className="shadow-glow">
                <Link to="/signup">
                  Get started <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button size="lg" variant="outline" asChild>
                <Link to="/login">Sign in</Link>
              </Button>
            </div>
            <div className="mt-12 flex flex-wrap items-center justify-center gap-6 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-success" /> Argon2/bcrypt
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-success" /> TOTP RFC 6238
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-success" /> JWT + refresh
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-success" /> Row-level security
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="border-b border-border py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Six layers of defense
            </h2>
            <p className="mt-3 text-muted-foreground">
              Each layer composes — every request crosses every check.
            </p>
          </div>
          <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <Card
                key={f.title}
                className="group relative overflow-hidden border-border bg-card p-6 transition-all hover:border-primary/40 hover:shadow-glow"
              >
                <div className="mb-4 inline-flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Threat matrix */}
      <section className="py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Threat model
            </h2>
            <p className="mt-3 text-muted-foreground">
              How each attack class is mitigated.
            </p>
          </div>
          <div className="mx-auto mt-14 max-w-4xl overflow-hidden rounded-xl border border-border bg-card shadow-card-cyber">
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-secondary/40">
                <tr>
                  <th className="p-4 text-left font-semibold">Attack</th>
                  <th className="p-4 text-left font-semibold">Mitigation</th>
                </tr>
              </thead>
              <tbody>
                {protections.map((p, i) => (
                  <tr
                    key={p.name}
                    className={i % 2 === 0 ? "bg-background/30" : ""}
                  >
                    <td className="p-4 font-medium">
                      <span className="flex items-center gap-2">
                        <Server className="h-3.5 w-3.5 text-primary" />
                        {p.name}
                      </span>
                    </td>
                    <td className="p-4 text-muted-foreground">{p.how}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-border bg-secondary/20 py-20">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold tracking-tight">Try it now</h2>
          <p className="mt-3 text-muted-foreground">
            Create an account, enroll TOTP, then explore the admin dashboard.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button size="lg" asChild className="shadow-glow">
              <Link to="/signup">Create account</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link to="/login">I have an account</Link>
            </Button>
          </div>
        </div>
      </section>
    </main>
  );
}
