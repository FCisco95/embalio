import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./types";

export async function supabaseServer() {
  const cookieStore = await cookies();
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) => {
          try {
            toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Called from a Server Component, where Next forbids cookie writes.
            // Safe to ignore: src/proxy.ts refreshes the session per request
            // and is the place the rotated tokens actually get persisted.
          }
        },
      },
    },
  );
}

// service-role client for cron jobs (bypasses RLS; use only in /api/cron)
import { createClient } from "@supabase/supabase-js";
export function supabaseService() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

/** Convenience alias — use in all app pages (local-only, service-role). */
export const supabaseApp = supabaseService
