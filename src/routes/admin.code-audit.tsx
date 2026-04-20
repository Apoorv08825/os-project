import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { FileSearch, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { RequireAuth } from "@/components/RequireAuth";

export const Route = createFileRoute("/admin/code-audit")({
  head: () => ({ meta: [{ title: "Code audit — SecureAuth" }] }),
  component: () => (
    <RequireAuth requireAdmin>
      <CodeAudit />
    </RequireAuth>
  ),
});

const RULES: { name: string; pattern: RegExp; severity: "critical" | "warning" }[] = [
  { name: "Hardcoded password assignment", pattern: /(password|passwd|pwd)\s*[:=]\s*["'][^"']{4,}["']/gi, severity: "critical" },
  { name: "Hardcoded API key", pattern: /(api[_-]?key|apikey)\s*[:=]\s*["'][A-Za-z0-9_\-]{16,}["']/gi, severity: "critical" },
  { name: "AWS access key", pattern: /AKIA[0-9A-Z]{16}/g, severity: "critical" },
  { name: "Private key block", pattern: /-----BEGIN (RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/g, severity: "critical" },
  { name: "JWT literal", pattern: /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, severity: "warning" },
  { name: "Bearer token literal", pattern: /Bearer\s+[A-Za-z0-9_\-\.]{20,}/g, severity: "warning" },
  { name: "TODO backdoor / debug auth", pattern: /\/\/.*(backdoor|skip\s*auth|disable\s*auth|admin\s*bypass)/gi, severity: "critical" },
  { name: "Hardcoded admin check", pattern: /===?\s*["']admin@admin/gi, severity: "critical" },
  { name: "eval() usage", pattern: /\beval\s*\(/g, severity: "warning" },
  { name: "dangerouslySetInnerHTML", pattern: /dangerouslySetInnerHTML/g, severity: "warning" },
];

const SAMPLE_VULNERABLE = `// Demo: paste your code here. Try this sample to see the scanner work:
const password = "admin123";
const apiKey = "sk-1234567890abcdef1234567890abcdef";
// backdoor: skip auth for testing
if (user.email === "admin@admin.com") return true;
const token = "Bearer eyJhbGciOiJIUzI1NiJ9.payload.signature1234567890";
const result = eval(userInput);`;

type Finding = {
  rule: string;
  severity: "critical" | "warning";
  line: number;
  match: string;
};

function CodeAudit() {
  const [code, setCode] = useState(SAMPLE_VULNERABLE);
  const [findings, setFindings] = useState<Finding[] | null>(null);
  const [scanning, setScanning] = useState(false);

  const scan = () => {
    setScanning(true);
    setTimeout(() => {
      const lines = code.split("\n");
      const out: Finding[] = [];
      RULES.forEach((rule) => {
        lines.forEach((ln, i) => {
          const matches = ln.match(rule.pattern);
          if (matches) {
            matches.forEach((m) =>
              out.push({ rule: rule.name, severity: rule.severity, line: i + 1, match: m.slice(0, 80) })
            );
          }
        });
      });
      setFindings(out);
      setScanning(false);
    }, 300);
  };

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Code audit scanner</h1>
        <p className="mt-2 text-muted-foreground">
          Scans source for hardcoded credentials, backdoors, eval, dangerous APIs, and trapdoor
          patterns. Runs entirely client-side.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-border bg-card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-semibold">
              <FileSearch className="h-4 w-4 text-primary" /> Source to scan
            </h2>
            <Button onClick={scan} disabled={scanning} size="sm">
              {scanning && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
              Run scan
            </Button>
          </div>
          <Textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="h-96 font-mono text-xs"
            maxLength={50000}
          />
          <p className="mt-2 text-xs text-muted-foreground">
            {code.length.toLocaleString()} / 50,000 chars · {code.split("\n").length} lines
          </p>
        </Card>

        <Card className="border-border bg-card p-5">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Findings</h2>
            {findings && (
              <div className="flex gap-2">
                <Badge variant="destructive">
                  {findings.filter((f) => f.severity === "critical").length} critical
                </Badge>
                <Badge variant="outline" className="border-warning text-warning">
                  {findings.filter((f) => f.severity === "warning").length} warning
                </Badge>
              </div>
            )}
          </div>
          <div className="h-96 space-y-2 overflow-y-auto">
            {!findings && (
              <p className="text-sm text-muted-foreground">
                Click "Run scan" to analyze the source.
              </p>
            )}
            {findings && findings.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12">
                <CheckCircle2 className="h-10 w-10 text-success" />
                <p className="mt-3 font-semibold">No issues detected</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Source passes all {RULES.length} audit rules.
                </p>
              </div>
            )}
            {findings?.map((f, i) => (
              <div
                key={i}
                className={`rounded-lg border p-3 ${
                  f.severity === "critical"
                    ? "border-destructive/40 bg-destructive/5"
                    : "border-warning/40 bg-warning/5"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertTriangle
                      className={`h-3.5 w-3.5 ${
                        f.severity === "critical" ? "text-destructive" : "text-warning"
                      }`}
                    />
                    <span className="text-sm font-medium">{f.rule}</span>
                  </div>
                  <Badge variant="outline" className="text-[10px]">
                    line {f.line}
                  </Badge>
                </div>
                <code className="mt-2 block break-all rounded bg-background/40 p-2 font-mono text-xs text-muted-foreground">
                  {f.match}
                </code>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </main>
  );
}
