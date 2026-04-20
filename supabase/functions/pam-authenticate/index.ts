// PAM-style authentication simulation.
// Mimics the Linux PAM stack: auth → account → session phases, returning a
// transcript that the UI displays. Does NOT bypass real auth — it inspects
// the already-authenticated user's RLS context.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type PamLine = { phase: string; module: string; result: "PASS" | "FAIL" | "INFO"; detail: string };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return new Response("Unauthorized", { status: 401, headers: corsHeaders });

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ??
        Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: auth } } }
    );
    const { data: userData } = await userClient.auth.getUser();
    if (!userData?.user) {
      return new Response("Unauthorized", { status: 401, headers: corsHeaders });
    }
    const user = userData.user;

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const transcript: PamLine[] = [];
    transcript.push({
      phase: "auth",
      module: "pam_unix.so",
      result: "PASS",
      detail: `JWT verified for uid=${user.id.slice(0, 8)}…`,
    });

    // account phase: roles
    const { data: roles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);
    transcript.push({
      phase: "account",
      module: "pam_access.so",
      result: "PASS",
      detail: `Roles: ${(roles ?? []).map((r) => r.role).join(", ") || "none"}`,
    });

    // account phase: lockout
    const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { count: fails } = await admin
      .from("failed_logins")
      .select("*", { count: "exact", head: true })
      .eq("email", user.email!.toLowerCase())
      .gte("attempted_at", since);
    transcript.push({
      phase: "account",
      module: "pam_tally.so",
      result: (fails ?? 0) >= 5 ? "FAIL" : "PASS",
      detail: `${fails ?? 0} failed attempts in last 15m`,
    });

    // session phase: MFA
    const { data: totp } = await admin
      .from("totp_secrets")
      .select("enrolled")
      .eq("user_id", user.id)
      .maybeSingle();
    transcript.push({
      phase: "session",
      module: "pam_oath.so",
      result: totp?.enrolled ? "PASS" : "INFO",
      detail: totp?.enrolled ? "TOTP enrolled" : "TOTP not enrolled (recommended)",
    });

    // session phase: trusted devices
    const { count: devices } = await admin
      .from("trusted_devices")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gt("expires_at", new Date().toISOString());
    transcript.push({
      phase: "session",
      module: "pam_env.so",
      result: "INFO",
      detail: `${devices ?? 0} trusted device(s) active`,
    });

    // log it
    await admin.from("audit_logs").insert({
      user_id: user.id,
      email: user.email,
      event: "login_success",
      severity: "info",
      metadata: { source: "pam-authenticate", transcript },
    });

    return new Response(JSON.stringify({ user: { id: user.id, email: user.email }, transcript }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
