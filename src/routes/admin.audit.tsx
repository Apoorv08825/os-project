import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Activity, AlertTriangle, ShieldCheck, Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { RequireAuth } from "@/components/RequireAuth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/audit")({
  head: () => ({ meta: [{ title: "Audit logs — SecureAuth" }] }),
  component: () => (
    <RequireAuth requireAdmin>
      <AuditLogs />
    </RequireAuth>
  ),
});

type LogRow = {
  id: string;
  event: string;
  severity: string;
  email: string | null;
  ip_address: string | null;
  created_at: string;
  metadata: unknown;
};

function AuditLogs() {
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    supabase
      .from("audit_logs")
      .select("id, event, severity, email, ip_address, created_at, metadata")
      .order("created_at", { ascending: false })
      .limit(200)
      .then(({ data }) => setLogs((data as LogRow[]) ?? []));
  }, []);

  const filtered = logs.filter((l) => {
    if (!filter) return true;
    const f = filter.toLowerCase();
    return (
      l.event.toLowerCase().includes(f) ||
      l.email?.toLowerCase().includes(f) ||
      l.severity.toLowerCase().includes(f)
    );
  });

  const sevIcon = (s: string) => {
    if (s === "critical")
      return <AlertTriangle className="h-3.5 w-3.5 text-destructive" />;
    if (s === "warning") return <AlertTriangle className="h-3.5 w-3.5 text-warning" />;
    return <ShieldCheck className="h-3.5 w-3.5 text-success" />;
  };

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Audit logs</h1>
          <p className="mt-1 text-muted-foreground">Last 200 security events.</p>
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Filter by event, email, severity..."
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-72 pl-8"
            maxLength={64}
          />
        </div>
      </div>

      <Card className="overflow-hidden border-border bg-card">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-secondary/30 text-left">
              <tr>
                <th className="p-3 font-semibold">Time</th>
                <th className="p-3 font-semibold">Event</th>
                <th className="p-3 font-semibold">Severity</th>
                <th className="p-3 font-semibold">Email</th>
                <th className="p-3 font-semibold">IP</th>
                <th className="p-3 font-semibold">Metadata</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((l) => (
                <tr key={l.id} className="border-b border-border last:border-0">
                  <td className="p-3 font-mono text-xs text-muted-foreground">
                    {new Date(l.created_at).toLocaleString()}
                  </td>
                  <td className="p-3">
                    <Badge variant="outline" className="font-mono">
                      <Activity className="mr-1 h-3 w-3" />
                      {l.event}
                    </Badge>
                  </td>
                  <td className="p-3">
                    <span className="flex items-center gap-1.5">
                      {sevIcon(l.severity)}
                      {l.severity}
                    </span>
                  </td>
                  <td className="p-3 font-mono text-xs">{l.email ?? "—"}</td>
                  <td className="p-3 font-mono text-xs text-muted-foreground">
                    {l.ip_address ?? "—"}
                  </td>
                  <td className="p-3 max-w-md">
                    <code className="line-clamp-2 break-all text-xs text-muted-foreground">
                      {l.metadata ? JSON.stringify(l.metadata).slice(0, 200) : "—"}
                    </code>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-muted-foreground">
                    No matching logs.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </main>
  );
}
