import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isSubscriptionActive } from "@/lib/subscription";

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh session — required so tokens don't expire
  const { data: { user } } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  const isPublic =
    pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/api/");

  // Not logged in → send to login (except public routes)
  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Logged-in user hitting login/register → redirect to their home
  if (user && (pathname === "/login" || pathname === "/register" || pathname === "/register/join")) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const url = request.nextUrl.clone();
    url.pathname = profile?.role === "admin" ? "/admin/dashboard" : "/";
    return NextResponse.redirect(url);
  }

  // Admin routes require admin role + active subscription
  if (pathname.startsWith("/admin") && user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, company_id")
      .eq("id", user.id)
      .single();

    if (profile?.role !== "admin") {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }

    // Skip subscription check on the billing page itself so locked-out admins can still reach it
    const isBillingPage = pathname === "/admin/billing";
    if (!isBillingPage && profile.company_id) {
      const { data: company } = await supabase
        .from("companies")
        .select("stripe_customer_id, subscription_status, subscription_period_end")
        .eq("id", profile.company_id)
        .single();

      // Only gate companies that have gone through Stripe (grandfathered = no customer ID)
      if (company?.stripe_customer_id) {
        const allowed = isSubscriptionActive(
          company.subscription_status ?? null,
          company.subscription_period_end ?? null
        );
        if (!allowed) {
          const url = request.nextUrl.clone();
          url.pathname = "/billing";
          return NextResponse.redirect(url);
        }
      }
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
