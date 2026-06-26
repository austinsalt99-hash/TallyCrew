import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

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

export interface UserProfile {
  id: string;
  company_id: string;
  full_name: string;
  role: "admin" | "worker";
  is_dev: boolean;
}

export async function getSessionUser(supabase: Awaited<ReturnType<typeof createSupabaseServer>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, profile: null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, company_id, full_name, role, is_dev")
    .eq("id", user.id)
    .single<UserProfile>();

  return { user, profile };
}
