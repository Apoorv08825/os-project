import { createFileRoute } from "@tanstack/react-router";
import { Lock, ShieldAlert, FileLock2, ServerCog } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RequireAuth } from "@/components/RequireAuth";
import { useAuth } from "@/lib/auth-context";

export const Route = createFileRoute("/resources")({
  head: () => ({
    meta: [
      { title: "Protected resources — SecureAuth" },
      { name: "description", content: "RBAC-protected resources." },
    ],
  }),
  component: () => (
    <RequireAuth>
      <Resources />
    </RequireAuth>
  ),
});

function Resources() {
  const { isAdmin, roles } = useAuth();

  return (
    <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Protected resources</h1>
        <p className="mt-2 text-muted-foreground">
          Demonstrates role-based access control. Your roles:{" "}
          {roles.map((r) => (
            <Badge key={r} variant="outline" className="ml-1">
              {r}
            </Badge>
          ))}
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-border bg-card p-6">
          <div className="flex items-start gap-3">
            <div className="rounded-lg bg-success/10 p-2 text-success">
              <FileLock2 className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="font-semibold">User documents</h3>
                <Badge className="bg-success text-success-foreground">Granted</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                All authenticated users can read this. Backed by RLS:{" "}
                <code className="text-xs text-foreground">auth.uid() = user_id</code>.
              </p>
              <div className="mt-4 rounded border border-border bg-background/40 p-3 font-mono text-xs text-muted-foreground">
                $ cat ~/secure_resource.txt
                <br />
                Welcome, authenticated user. Your access is logged.
              </div>
            </div>
          </div>
        </Card>

        <Card
          className={`border p-6 ${isAdmin ? "border-border bg-card" : "border-destructive/30 bg-destructive/5"}`}
        >
          <div className="flex items-start gap-3">
            <div
              className={`rounded-lg p-2 ${isAdmin ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive"}`}
            >
              {isAdmin ? <ServerCog className="h-5 w-5" /> : <ShieldAlert className="h-5 w-5" />}
            </div>
            <div className="flex-1">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="font-semibold">System control plane</h3>
                {isAdmin ? (
                  <Badge className="bg-primary text-primary-foreground">Admin</Badge>
                ) : (
                  <Badge variant="destructive">Denied</Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                Requires{" "}
                <code className="text-xs text-foreground">has_role(auth.uid(), 'admin')</code>.
              </p>
              <div className="mt-4 rounded border border-border bg-background/40 p-3 font-mono text-xs">
                {isAdmin ? (
                  <span className="text-success">
                    $ sudo systemctl status auth-framework
                    <br />● auth-framework.service: active (running)
                  </span>
                ) : (
                  <span className="text-destructive">
                    $ sudo systemctl status auth-framework
                    <br />Permission denied. Insufficient privileges.
                  </span>
                )}
              </div>
            </div>
          </div>
        </Card>

        <Card className="border-border bg-card p-6 md:col-span-2">
          <div className="mb-3 flex items-center gap-2">
            <Lock className="h-4 w-4 text-primary" />
            <h3 className="font-semibold">How RLS works here</h3>
          </div>
          <pre className="overflow-x-auto rounded-lg bg-background/40 p-4 text-xs leading-relaxed">
            <code className="text-muted-foreground">
              <span className="text-primary">CREATE POLICY</span> "Users view own profile"{" "}
              <span className="text-primary">ON</span> public.profiles
              <br />
              {"  "}<span className="text-primary">FOR SELECT USING</span> (auth.uid() = user_id);
              <br />
              <br />
              <span className="text-primary">CREATE POLICY</span> "Admins view all"{" "}
              <span className="text-primary">ON</span> public.profiles
              <br />
              {"  "}<span className="text-primary">FOR SELECT USING</span> (
              public.has_role(auth.uid(), <span className="text-accent">'admin'</span>));
            </code>
          </pre>
        </Card>
      </div>
    </main>
  );
}
