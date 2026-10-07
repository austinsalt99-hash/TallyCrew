import { createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";

export async function createSupabaseServer() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // setAll called from a Server Component — cookies can't be set,
            // but that's fine; the middleware handles session refresh.
          }
        },
      },
    }
  );
}

// Only id and email are read anywhere this is used (checked across every call site) —
// kept this narrow on purpose, see getSessionUser below.
export interface SessionUser {
  id: string;
  email?: string;
}

export interface UserProfile {
  id: string;
  company_id: string;
  full_name: string;
  role: "admin" | "worker";
  is_dev: boolean;
}

// The proxy (src/proxy.ts) already validates the session and fetches the profile for
// every request that reaches here, so this reads its result from a trusted request
// header instead of re-querying Supabase — cutting a full auth + profile round trip
// off of every API call. Falls back to querying directly if the header is missing or
// malformed (a request outside the proxy's matcher, or local testing), so this is
// never less correct, only sometimes slower.
export async function getSessionUser(supabase: Awaited<ReturnType<typeof createSupabaseServer>>) {
  const trusted = (await headers()).get("x-tc-session");
  if (trusted) {
    try {
      const parsed = JSON.parse(trusted) as { user: SessionUser | null; profile: UserProfile | null };
      if (parsed.user?.id) return { user: parsed.user, profile: parsed.profile };
    } catch {
      // Malformed header: fall through to the direct lookup below.
    }
  }

  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) return { user: null, profile: null };
  const user: SessionUser = { id: authUser.id, email: authUser.email };

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, company_id, full_name, role, is_dev")
    .eq("id", authUser.id)
    .single<UserProfile>();

  return { user, profile };
}
