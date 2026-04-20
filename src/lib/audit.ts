import { supabase } from "@/integrations/supabase/client";
import type { Database, Json } from "@/integrations/supabase/types";

type AuditEvent = Database["public"]["Enums"]["audit_event"];

type AuditInsert = Database["public"]["Tables"]["audit_logs"]["Insert"];

/**
 * Client-side audit log writer (uses authenticated user's RLS context).
 * Server-side events are written by edge functions with the service role.
 */
export async function logAudit(
  event: AuditEvent,
  opts: {
    severity?: "info" | "warning" | "critical";
    metadata?: Record<string, unknown>;
  } = {}
) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const row: AuditInsert = {
      user_id: user.id,
      email: user.email ?? null,
      event,
      severity: opts.severity ?? "info",
      user_agent:
        typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 255) : null,
      metadata: (opts.metadata ?? {}) as Json,
    };
    await supabase.from("audit_logs").insert(row);
  } catch {
    // Never let logging break the app
  }
}
