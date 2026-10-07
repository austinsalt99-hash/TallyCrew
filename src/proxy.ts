import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isSubscriptionActive } from "@/lib/subscription";

export async function proxy(request: NextRequest) {
  // Carries the resolved session + profile to the route handler via getSessionUser()
  // (src/lib/supabase-server.ts), so it doesn't have to re-validate the session and
  // re-fetch the profile that this function already looked up — see the "x-tc-session"
  // header set near the end of this function for the other half of this. Declared
  // before any branching, and the delete happens before anything else touches it:
  // without that, a client could set this header itself and have getSessionUser()
  // trust it as an arbitrary signed-in user — a full auth bypass. It's only ever set
  // back below, by this function, from a session it just validated itself.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.delete("x-tc-session");

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

  // Only the bare apex serves the marketing site at "/". www.tallycrew.ca must
  // keep serving the product there — older native app builds (pre
  // app.tallycrew.ca) are hardcoded to that exact host and would otherwise
  // load the marketing site instead of the app. app.tallycrew.ca (and
  // everything else, incl. localhost) keeps serving the product at "/" as
  // before.
  //
  // The marketing site's own sub-pages have no same-named counterpart in the
  // product, though, so they're safe to rewrite on any host. This is what
  // lets SiteNav/SiteFooter's relative links (e.g. href="/pricing") work when
  // the marketing site is reached somewhere other than the bare apex — a
  // local dev server, a preview deployment — instead of hitting the product's
  // login-wall and bouncing to /login.
  const MARKETING_SUBPATHS = ["/pricing", "/features", "/demo", "/help"];
  const isMarketingSubpath = MARKETING_SUBPATHS.some(
    (p) => rawPathname === p || rawPathname.startsWith(`${p}/`)
  );

  if ((isMarketingHost || isMarketingSubpath) && !isMetadataRoute) {
    const url = request.nextUrl.clone();
    const { pathname } = url;
    url.pathname = `/site${pathname === "/" ? "" : pathname}`;
    return NextResponse.rewrite(url, { request: { headers: requestHeaders } });
  }

  if (isMetadataRoute) {
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  let supabaseResponse = NextResponse.next({ request: { headers: requestHeaders } });

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
          supabaseResponse = NextResponse.next({ request: { headers: requestHeaders } });
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
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/privacy") ||
    pathname.startsWith("/terms") ||
    pathname.startsWith("/support") ||
    pathname.startsWith("/site") ||
    // Service worker script (+ its cacheOnNavigation companion worker) and
    // offline fallback page must be reachable even when logged out, or
    // offline caching breaks on every /login visit.
    pathname === "/sw.js" ||
    /^\/swe-worker-[^/]+\.js$/.test(pathname) ||
    pathname.startsWith("/~offline");

  // Not logged in → send to login (except public routes), preserving where
  // they were headed so e.g. a Stripe checkout return isn't lost mid-flow
  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("redirectTo", `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(url);
  }

  // Logged-in user hitting login/register-join → redirect to their home.
  // "/register" is deliberately excluded: the marketing site's "Start free
  // trial" button should always land on the create-a-new-company form, even
  // for someone who happens to already be logged in (e.g. an existing admin
  // wanting to set up a second company) — signing up there re-authenticates
  // as the new account, replacing whatever session was active before.
  if (user && (pathname === "/login" || pathname === "/register/join")) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const url = request.nextUrl.clone();
    url.pathname = profile?.role === "admin" ? "/admin/home" : "/";
    return NextResponse.redirect(url);
  }

  // Routes that must work regardless of subscription state. Two groups:
  // plain public pages (login/register/legal/etc. — same list as isPublic,
  // minus the blanket "/api/" entry, since that's exactly what needs to
  // stop being exempt), and the specific API routes that must keep
  // working even for an inactive company — Stripe checkout/portal are
  // literally how someone pays, the webhook has its own signature-based
  // auth and is what marks a subscription active in the first place, cron
  // has its own bearer-secret auth with no session involved, and
  // /api/auth + /api/dev run before a normal session exists or are
  // internal tooling.
  const isBillingExempt =
    pathname.startsWith("/login") ||
    pathname.startsWith("/register") ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/privacy") ||
    pathname.startsWith("/terms") ||
    pathname.startsWith("/support") ||
    pathname.startsWith("/site") ||
    pathname === "/sw.js" ||
    /^\/swe-worker-[^/]+\.js$/.test(pathname) ||
    pathname.startsWith("/~offline") ||
    pathname === "/billing" ||
    pathname === "/admin/billing" ||
    pathname.startsWith("/api/stripe/") ||
    pathname.startsWith("/api/cron/") ||
    pathname.startsWith("/api/auth/") ||
    pathname.startsWith("/api/dev/") ||
    pathname === "/api/admin/login";

  // Selected once here and forwarded via the "x-tc-session" header below, instead of
  // every API route re-fetching the same row through getSessionUser().
  let sessionProfile: { id: string; company_id: string; full_name: string | null; role: string; is_dev: boolean } | null = null;

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, company_id, full_name, role, is_dev")
      .eq("id", user.id)
      .single();
    sessionProfile = profile;

    // Admin routes require the admin role — workers get bounced home.
    if (pathname.startsWith("/admin") && profile?.role !== "admin") {
      const url = request.nextUrl.clone();
      url.pathname = "/";
      return NextResponse.redirect(url);
    }

    // Subscription gate — applies everywhere (every page and every API
    // route), not just /admin: a company that never finishes checkout or
    // has since canceled shouldn't retain working access to submit
    // timesheets, read the calendar, etc. just because its users still
    // have a valid login session. API calls get a 402 JSON error; page
    // navigations get redirected to the billing page.
    if (!isBillingExempt && profile?.company_id) {
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
          if (pathname.startsWith("/api/")) {
            return NextResponse.json(
              { error: "This company's subscription is inactive." },
              { status: 402 }
            );
          }
          const url = request.nextUrl.clone();
          url.pathname = "/billing";
          return NextResponse.redirect(url);
        }
      }
    }
  }

  if (user) {
    requestHeaders.set(
      "x-tc-session",
      JSON.stringify({
        user: { id: user.id, email: user.email ?? null },
        profile: sessionProfile,
      })
    );
  }

  // Rebuilt fresh here (rather than reusing supabaseResponse directly) so the header
  // above is present regardless of whether the Supabase client's setAll ran during
  // this request — its cookies (if any were refreshed) are copied across below.
  const finalResponse = NextResponse.next({ request: { headers: requestHeaders } });
  supabaseResponse.cookies.getAll().forEach((cookie) => finalResponse.cookies.set(cookie));
  return finalResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
