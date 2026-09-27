import { NextResponse } from "next/server";
import { parseVoiceEventText } from "@/lib/parseVoiceEvent";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";

// Public, unauthenticated endpoint backing the marketing site's live Siri
// demo (src/app/site/demo/page.tsx) — it runs the exact same Claude call the
// real app uses (parseVoiceEventText), just without a session and without
// writing anything to job_events. Since anyone on the internet can hit this
// without logging in, it's capped hard per IP so it can't be used to run up
// the Anthropic bill: 5 requests per rolling 24h window (best-effort — see
// checkRateLimit's own caveat about in-memory/per-instance storage), plus a
// generous but bounded input length so a single request can't blow up token
// cost even within that cap.
const DEMO_MAX_USES = 5;
const DEMO_WINDOW_MS = 24 * 60 * 60 * 1000;
const MAX_TEXT_LENGTH = 400;

export async function POST(request: Request) {
  // Validate before spending one of the 5 tries — an empty or oversized
  // request never reaches Claude, so it shouldn't burn the visitor's quota.
  const { text } = await request.json().catch(() => ({ text: undefined }));
  if (!text?.trim()) return NextResponse.json({ error: "No text provided" }, { status: 400 });
  if (text.length > MAX_TEXT_LENGTH) {
    return NextResponse.json({ error: "That's a bit long for the demo — try a shorter phrase." }, { status: 400 });
  }

  const ip = getClientIp(request);
  if (!checkRateLimit(`demo-parse-voice:${ip}`, DEMO_MAX_USES, DEMO_WINDOW_MS)) {
    return NextResponse.json(
      { error: `This demo is limited to ${DEMO_MAX_USES} tries — start a free trial to keep going in the real app.` },
      { status: 429 }
    );
  }

  try {
    const parsed = await parseVoiceEventText(text);
    return NextResponse.json(parsed);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to parse voice input" },
      { status: 500 }
    );
  }
}
