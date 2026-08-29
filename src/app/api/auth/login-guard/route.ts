import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

// Called by the login form before signInWithPassword. The actual auth call
// goes straight from the browser to Supabase (see login/page.tsx), so this
// can't stop someone who calls Supabase's auth endpoint directly with the
// public anon key — it only throttles scripted abuse against our own login
// form, same as the registration endpoints already do.
export async function POST(req: NextRequest) {
  const { email } = await req.json().catch(() => ({ email: undefined }));
  const ip = getClientIp(req);

  const ipOk = checkRateLimit(`login:ip:${ip}`, 30, 15 * 60 * 1000);
  const emailOk =
    !email || checkRateLimit(`login:email:${String(email).toLowerCase()}`, 8, 15 * 60 * 1000);

  if (!ipOk || !emailOk) {
    return NextResponse.json(
      { error: "Too many login attempts. Please wait a few minutes and try again." },
      { status: 429 }
    );
  }

  return NextResponse.json({ ok: true });
}
