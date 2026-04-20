// Verifies an email OTP. Single-use, expires after 5 minutes.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

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

    const { code } = await req.json();
    if (typeof code !== "string" || !/^\d{6}$/.test(code)) {
      return new Response(JSON.stringify({ ok: false, reason: "invalid format" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const candidateHash = await sha256Hex(code);
    const { data } = await admin
      .from("email_otps")
      .select("id, expires_at, used")
      .eq("user_id", userData.user.id)
      .eq("code_hash", candidateHash)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!data) {
      await admin.from("audit_logs").insert({
        user_id: userData.user.id,
        email: userData.user.email,
        event: "mfa_failed",
        severity: "warning",
        metadata: { factor: "email_otp", reason: "no match" },
      });
      return new Response(JSON.stringify({ ok: false, reason: "incorrect" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (data.used) {
      return new Response(JSON.stringify({ ok: false, reason: "already used" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (new Date(data.expires_at).getTime() < Date.now()) {
      return new Response(JSON.stringify({ ok: false, reason: "expired" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await admin.from("email_otps").update({ used: true }).eq("id", data.id);
    await admin.from("audit_logs").insert({
      user_id: userData.user.id,
      email: userData.user.email,
      event: "mfa_verified",
      severity: "info",
      metadata: { factor: "email_otp" },
    });

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
