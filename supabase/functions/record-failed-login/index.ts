// Records a failed login attempt and writes an audit entry.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { email } = await req.json();
    if (typeof email !== "string" || email.length > 254) {
      return new Response(JSON.stringify({ error: "invalid" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
    const ua = req.headers.get("user-agent")?.slice(0, 255) ?? null;
    const lower = email.toLowerCase();

    await supabase.from("failed_logins").insert({
      email: lower,
      ip_address: ip,
      user_agent: ua,
    });

    // Check if this puts the account over the threshold and audit-log it
    const since = new Date(Date.now() - 15 * 60 * 1000).toISOString();
    const { count } = await supabase
      .from("failed_logins")
      .select("*", { count: "exact", head: true })
      .eq("email", lower)
      .gte("attempted_at", since);

    // Find user (if exists) for audit log
    const { data: profile } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("email", lower)
      .maybeSingle();

    await supabase.from("audit_logs").insert({
      user_id: profile?.user_id ?? null,
      email: lower,
      event: "login_failed",
      severity: (count ?? 0) >= 5 ? "warning" : "info",
      ip_address: ip,
      user_agent: ua,
      metadata: { fails_in_window: count ?? 0 },
    });

    if ((count ?? 0) >= 5) {
      await supabase.from("audit_logs").insert({
        user_id: profile?.user_id ?? null,
        email: lower,
        event: "account_locked",
        severity: "warning",
        ip_address: ip,
        user_agent: ua,
        metadata: { window_minutes: 15, threshold: 5 },
      });
    }

    return new Response(JSON.stringify({ ok: true, fails: count ?? 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
