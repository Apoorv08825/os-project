import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Users, Activity, FileSearch, FileCheck2, ShieldCheck } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RequireAuth } from "@/components/RequireAuth";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin — SecureAuth" }] }),
  component: () => (
    <RequireAuth requireAdmin>
      <Admin />
    </RequireAuth>
  ),
});

type Profile = {
  user_id: string;
  email: string;
  display_name: string | null;
};

function Admin() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [roles, setRoles] = useState<Record<string, string[]>>({});
  const [stats, setStats] = useState({ users: 0, events24h: 0, lockouts: 0, mfa: 0 });

  const load = async () => {
    const [{ data: profs }, { data: rs }, { data: events }, { data: locks }, { data: mfa }] =
      await Promise.all([
        supabase.from("profiles").select("user_id, email, display_name"),
        supabase.from("user_roles").select("user_id, role"),
        supabase
          .from("audit_logs")
          .select("id", { count: "exact", head: true })
          .gte("created_at", new Date(Date.now() - 86400000).toISOString()),
        supabase
          .from("audit_logs")
          .select("id", { count: "exact", head: true })
          .eq("event", "account_locked"),
        supabase.from("totp_secrets").select("user_id", { count: "exact", head: true }).eq("enrolled", true),
      ]);

    setProfiles(profs ?? []);
    const map: Record<string, string[]> = {};
    (rs ?? []).forEach((r: { user_id: string; role: string }) => {
      map[r.user_id] = [...(map[r.user_id] ?? []), r.role];
    });
    setRoles(map);
    setStats({
      users: profs?.length ?? 0,
      events24h: (events as unknown as { count?: number })?.count ?? 0,
      lockouts: (locks as unknown as { count?: number })?.count ?? 0,
      mfa: (mfa as unknown as { count?: number })?.count ?? 0,
    });
  };

  useEffect(() => {
    load();
  }, []);

  const toggleAdmin = async (userId: string, isAdmin: boolean) => {
    if (isAdmin) {
      await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", "admin");
      toast.success("Admin revoked");
    } else {
      await supabase.from("user_roles").insert({ user_id: userId, role: "admin" });
      toast.success("Admin granted");
    }
    await supabase.from("audit_logs").insert({
      user_id: userId,
      event: isAdmin ? "role_revoked" : "role_granted",
      severity: "warning",
      metadata: { role: "admin" },
    });
    await load();
  };

  const resetLockout = async (email: string) => {
    await supabase.from("failed_logins").delete().eq("email", email.toLowerCase());
    await supabase.from("audit_logs").insert({
      email,
      event: "account_unlocked",
      severity: "info",
    });
    toast.success(`Lockout cleared for ${email}`);
  };

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Admin Console</h1>
          <p className="mt-1 text-muted-foreground">
            User management · audit logs · code audit · integrity checks
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link to="/admin/audit">
              <Activity className="mr-2 h-4 w-4" /> Audit logs
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/admin/code-audit">
              <FileSearch className="mr-2 h-4 w-4" /> Code audit
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/admin/integrity">
              <FileCheck2 className="mr-2 h-4 w-4" /> Integrity
            </Link>
          </Button>
        </div>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Users", value: stats.users, icon: Users },
          { label: "Events (24h)", value: stats.events24h, icon: Activity },
          { label: "Lockouts (all)", value: stats.lockouts, icon: ShieldCheck },
          { label: "MFA enrolled", value: stats.mfa, icon: ShieldCheck },
        ].map((s) => (
          <Card key={s.label} className="border-border bg-card p-5">
            <div className="flex items-center justify-between">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                {s.label}
              </div>
              <s.icon className="h-4 w-4 text-primary" />
            </div>
            <div className="mt-2 text-3xl font-bold">{s.value}</div>
          </Card>
        ))}
      </div>

      <Card className="border-border bg-card">
        <div className="border-b border-border p-5">
          <h2 className="font-semibold">User management</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-secondary/30 text-left">
              <tr>
                <th className="p-3 font-semibold">Email</th>
                <th className="p-3 font-semibold">Display name</th>
                <th className="p-3 font-semibold">Roles</th>
                <th className="p-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {profiles.map((p) => {
                const userRoles = roles[p.user_id] ?? [];
                const isAdmin = userRoles.includes("admin");
                return (
                  <tr key={p.user_id} className="border-b border-border last:border-0">
                    <td className="p-3 font-mono text-xs">{p.email}</td>
                    <td className="p-3">{p.display_name ?? "—"}</td>
                    <td className="p-3">
                      <div className="flex gap-1">
                        {userRoles.map((r) => (
                          <Badge key={r} variant={r === "admin" ? "default" : "outline"}>
                            {r}
                          </Badge>
                        ))}
                      </div>
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          size="sm"
                          variant={isAdmin ? "destructive" : "outline"}
                          onClick={() => toggleAdmin(p.user_id, isAdmin)}
                        >
                          {isAdmin ? "Revoke admin" : "Grant admin"}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => resetLockout(p.email)}>
                          Clear lockout
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {profiles.length === 0 && (
                <tr>
                  <td colSpan={4} className="p-6 text-center text-muted-foreground">
                    No users found.
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
