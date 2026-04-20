// Lockout check: returns { locked: boolean, minutes_remaining?: number }
// 5 failed logins within 15 minutes triggers a 15-minute lockout.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILS = 5;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { email } = await req.json();
    if (typeof email !== "string" || email.length > 254) {
      return new Response(JSON.stringify({ error: "invalid email" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const since = new Date(Date.now() - WINDOW_MS).toISOString();
    const { data, error } = await supabase
      .from("failed_logins")
      .select("attempted_at")
      .eq("email", email.toLowerCase())
      .gte("attempted_at", since)
      .order("attempted_at", { ascending: false });

    if (error) throw error;

    const fails = data?.length ?? 0;
    if (fails >= MAX_FAILS) {
      const lastAttempt = new Date(data![0].attempted_at).getTime();
      const unlockAt = lastAttempt + WINDOW_MS;
      const minutesRemaining = Math.max(1, Math.ceil((unlockAt - Date.now()) / 60000));
      return new Response(
        JSON.stringify({ locked: true, fails, minutes_remaining: minutesRemaining }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ locked: false, fails }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
