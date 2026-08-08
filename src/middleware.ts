import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isSubscriptionActive } from "@/lib/subscription";

export async function middleware(request: NextRequest) {
  const hostname = request.headers.get("host") ?? "";
  const isMarketingHost = hostname === "tallycrew.ca";
  const { pathname: rawPathname } = request.nextUrl;

  // robots.txt / sitemap.xml are single host-aware files at the app root
  // (src/app/robots.ts, src/app/sitemap.ts) — never rewritten to /site.
  // Google/Bing site-verification HTML files (served as static files from
  // /public) must also stay at the bare root path, unrewritten.
  const isMetadataRoute =
    rawPathname === "/robots.txt" ||
    rawPathname === "/sitemap.xml" ||
    /^\/google[0-9a-f]+\.html$/.test(rawPathname) ||
    /^\/BingSiteAuth\.xml$/.test(rawPathname);

  // Only the bare apex serves the marketing site. www.tallycrew.ca must keep
  // serving the product — older native app builds (pre app.tallycrew.ca) are
  // hardcoded to that exact host and would otherwise load the marketing site
  // instead of the app. app.tallycrew.ca (and everything else, incl. localhost)
  // keeps serving the product as before.
  if (isMarketingHost && !isMetadataRoute) {
    const url = request.nextUrl.clone();
    const { pathname } = url;
    url.pathname = `/site${pathname === "/" ? "" : pathname}`;
    return NextResponse.rewrite(url);
  }

  if (isMetadataRoute) {
    return NextResponse.next({ request });
  }

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
    pathname.startsWith("/api/") ||
    pathname.startsWith("/privacy") ||
    pathname.startsWith("/terms") ||
    pathname.startsWith("/site");

  // Not logged in → send to login (except public routes), preserving where
  // they were headed so e.g. a Stripe checkout return isn't lost mid-flow
  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("redirectTo", `${pathname}${request.nextUrl.search}`);
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
    url.pathname = profile?.role === "admin" ? "/admin/home" : "/";
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

      // Gate companies that have gone through Stripe, or that are freshly
      // registered and still "pending" first payment. Companies with neither
      // a customer ID nor "pending" status are grandfathered (pre-date billing).
      const status = company?.subscription_status ?? null;
      if (company?.stripe_customer_id || status === "pending") {
        const allowed = isSubscriptionActive(
          status,
          company?.subscription_period_end ?? null
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
