import "server-only";

import { createClient } from "@supabase/supabase-js";

export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("[supabase][admin] missing env vars", {
      hasUrl: !!supabaseUrl,
      hasServiceRoleKey: !!serviceRoleKey
    });
    throw new Error("Missing Supabase server environment variables.");
  }

  if (!serviceRoleKey.includes("service_role")) {
    console.warn("[supabase][admin] SUPABASE_SERVICE_ROLE_KEY does not look like a service_role JWT");
  }

  try {
    return createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  } catch (error) {
    console.error("[supabase][admin] failed to create client", {
      hasUrl: !!supabaseUrl,
      hasServiceRoleKey: !!serviceRoleKey,
      error: error instanceof Error ? error.message : String(error)
    });
    throw error;
  }
}
