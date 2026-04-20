// Checks whether a candidate password matches the last 5 hashes for the user.
// Uses SHA-256 (demo simplification — real systems would re-bcrypt with stored salts).
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

    const { password } = await req.json();
    if (typeof password !== "string" || password.length > 128 || password.length < 1) {
      return new Response(JSON.stringify({ error: "invalid" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const candidate = await sha256Hex(password);
    const { data } = await admin
      .from("password_history")
      .select("password_hash")
      .eq("user_id", userData.user.id)
      .order("created_at", { ascending: false })
      .limit(5);

    const reused = (data ?? []).some((row) => row.password_hash === candidate);
    return new Response(JSON.stringify({ reused }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
