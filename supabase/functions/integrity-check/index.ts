// Computes SHA-256 hash of an artifact string sent by the client and compares
// against the stored hash in integrity_hashes. Used by the admin integrity page
// to verify that critical edge-function source has not been tampered with.
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

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // verify admin role
    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action, artifact_name, content } = body;

    if (action === "record") {
      if (typeof artifact_name !== "string" || typeof content !== "string") {
        return new Response("invalid", { status: 400, headers: corsHeaders });
      }
      const hash = await sha256Hex(content);
      await admin
        .from("integrity_hashes")
        .upsert({ artifact_name, sha256: hash, recorded_at: new Date().toISOString() });
      await admin.from("audit_logs").insert({
        user_id: userData.user.id,
        email: userData.user.email,
        event: "integrity_check",
        severity: "info",
        metadata: { action: "record", artifact_name, sha256: hash },
      });
      return new Response(JSON.stringify({ ok: true, sha256: hash }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "verify") {
      if (typeof artifact_name !== "string" || typeof content !== "string") {
        return new Response("invalid", { status: 400, headers: corsHeaders });
      }
      const expected = await sha256Hex(content);
      const { data: stored } = await admin
        .from("integrity_hashes")
        .select("sha256, recorded_at")
        .eq("artifact_name", artifact_name)
        .maybeSingle();
      const match = !!stored && stored.sha256 === expected;
      await admin.from("audit_logs").insert({
        user_id: userData.user.id,
        email: userData.user.email,
        event: "integrity_check",
        severity: match ? "info" : "critical",
        metadata: { action: "verify", artifact_name, match, expected },
      });
      return new Response(
        JSON.stringify({
          ok: true,
          match,
          expected,
          stored: stored?.sha256 ?? null,
          recorded_at: stored?.recorded_at ?? null,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response("invalid action", { status: 400, headers: corsHeaders });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
