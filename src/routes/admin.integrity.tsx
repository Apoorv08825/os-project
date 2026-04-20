import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { FileCheck2, Loader2, CheckCircle2, AlertTriangle, Save, Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { RequireAuth } from "@/components/RequireAuth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/integrity")({
  head: () => ({ meta: [{ title: "Integrity check — SecureAuth" }] }),
  component: () => (
    <RequireAuth requireAdmin>
      <Integrity />
    </RequireAuth>
  ),
});

type Result = { match: boolean; expected: string; stored: string | null; recorded_at: string | null } | null;

function Integrity() {
  const [name, setName] = useState("auth-handler.ts");
  const [content, setContent] = useState(
    "// Sample artifact — paste edge function source here\nexport function authenticate(user, pw) {\n  return verify(user, pw);\n}"
  );
  const [result, setResult] = useState<Result>(null);
  const [loading, setLoading] = useState(false);

  const call = async (action: "record" | "verify") => {
    if (!name.trim()) return toast.error("Name required");
    setLoading(true);
    setResult(null);
    const { data, error } = await supabase.functions.invoke("integrity-check", {
      body: { action, artifact_name: name.trim(), content },
    });
    setLoading(false);
    if (error || !data?.ok) {
      toast.error("Check failed");
      return;
    }
    if (action === "record") {
      toast.success("Baseline hash recorded");
    } else {
      setResult({
        match: data.match,
        expected: data.expected,
        stored: data.stored,
        recorded_at: data.recorded_at,
      });
      if (data.match) toast.success("Integrity verified");
      else toast.error("Integrity MISMATCH — possible tampering");
    }
  };

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Integrity check</h1>
        <p className="mt-2 text-muted-foreground">
          Stores a SHA-256 baseline for any artifact (edge function source, config, binary text)
          and verifies later that the content has not been tampered with.
        </p>
      </div>

      <Card className="border-border bg-card p-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-1.5 sm:col-span-1">
            <Label htmlFor="name">Artifact name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={128}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-3">
            <Label htmlFor="content">Content</Label>
            <Textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="h-48 font-mono text-xs"
              maxLength={100000}
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <Button onClick={() => call("record")} disabled={loading} variant="outline">
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Save className="mr-2 h-4 w-4" />
            Record baseline
          </Button>
          <Button onClick={() => call("verify")} disabled={loading} className="shadow-glow">
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Search className="mr-2 h-4 w-4" />
            Verify integrity
          </Button>
        </div>

        {result && (
          <div
            className={`mt-6 rounded-lg border p-4 ${
              result.match
                ? "border-success/40 bg-success/5"
                : "border-destructive/40 bg-destructive/5"
            }`}
          >
            <div className="mb-3 flex items-center gap-2">
              {result.match ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-success" />
                  <span className="font-semibold text-success">Integrity verified</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                  <span className="font-semibold text-destructive">
                    MISMATCH — content has changed
                  </span>
                </>
              )}
            </div>
            <div className="space-y-2 font-mono text-xs">
              <div>
                <span className="text-muted-foreground">Computed:</span>{" "}
                <span className="break-all">{result.expected}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Stored:&nbsp;&nbsp;&nbsp;</span>{" "}
                <span className="break-all">{result.stored ?? "(none recorded)"}</span>
              </div>
              {result.recorded_at && (
                <div>
                  <span className="text-muted-foreground">Recorded:</span>{" "}
                  {new Date(result.recorded_at).toLocaleString()}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="mt-6 flex items-start gap-2 rounded-lg border border-border bg-secondary/20 p-3 text-xs text-muted-foreground">
          <FileCheck2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <p>
            Use this in CI: record the baseline at deploy time, then have a scheduled job (or
            admin) periodically verify. Any drift triggers a <Badge variant="destructive">critical</Badge>{" "}
            audit log entry.
          </p>
        </div>
      </Card>
    </main>
  );
}
