import { NextResponse } from "next/server";
import { Resend } from "resend";
import { createSupabaseServer, getSessionUser } from "@/lib/supabase-server";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

// Public contact address shown in the email footer.
const FOOTER_CONTACT_EMAIL = "contact@tallycrew.ca";
// Where "Send test to yourself" delivers to — the developer's own inbox, not the public contact address.
const TEST_RECIPIENT = "austinsalt99@gmail.com";
const LOGO_URL = "https://app.tallycrew.ca/tally-wordmark.png";
const SITE_URL = "https://tallycrew.ca";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildBroadcastHtml(body: string): string {
  const paragraphs = body
    .split(/\n{2,}/)
    .map((p) => `<p style="margin:0 0 16px;">${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("");

  const fontStack = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";

  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6; padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px; background-color:#ffffff; border-radius:12px; border:1px solid #e5e7eb;">
          <tr>
            <td style="padding:28px 32px 20px;">
              <img src="${LOGO_URL}" alt="TallyCrew" width="140" style="display:block; border:0; outline:none;" />
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 28px; font-family:${fontStack}; font-size:14px; line-height:1.6; color:#111827;">
              ${paragraphs}
            </td>
          </tr>
          <tr>
            <td style="padding:20px 32px 28px; border-top:1px solid #e5e7eb; font-family:${fontStack}; font-size:12px; line-height:1.7; color:#6b7280;">
              <strong style="color:#374151;">TallyCrew</strong><br>
              This is a service notice regarding your TallyCrew account.<br>
              <a href="mailto:${FOOTER_CONTACT_EMAIL}" style="color:#1d4ed8; text-decoration:none;">${FOOTER_CONTACT_EMAIL}</a>
              &nbsp;&middot;&nbsp;
              <a href="${SITE_URL}" style="color:#1d4ed8; text-decoration:none;">tallycrew.ca</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>`;
}

// Emails live on auth.users, not profiles — page through the admin API to map id -> email.
async function loadEmailsById(admin: ReturnType<typeof createSupabaseAdmin>): Promise<Map<string, string>> {
  const emailById = new Map<string, string>();
  const perPage = 1000;
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    for (const u of data.users) {
      if (u.email) emailById.set(u.id, u.email);
    }
    if (data.users.length < perPage) break;
  }
  return emailById;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Full recipient list for the composer's picker (search/select by person or company).
export async function GET() {
  const supabase = await createSupabaseServer();
  const { profile } = await getSessionUser(supabase);
  if (!profile?.is_dev) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = createSupabaseAdmin();

  const { data: profiles, error: profilesError } = await admin
    .from("profiles")
    .select("id, full_name, role, companies(name)")
    .order("full_name");
  if (profilesError) {
    console.error("Broadcast: failed to load profiles", profilesError);
    return NextResponse.json({ error: "Failed to load recipients" }, { status: 500 });
  }

  let emailById: Map<string, string>;
  try {
    emailById = await loadEmailsById(admin);
  } catch (err) {
    console.error("Broadcast: failed to load user emails", err);
    return NextResponse.json({ error: "Failed to load user emails" }, { status: 500 });
  }

  const recipients = (profiles ?? [])
    .map((p) => {
      const email = emailById.get(p.id);
      if (!email) return null;
      const companies = p.companies as { name: string } | { name: string }[] | null;
      const companyName = Array.isArray(companies) ? companies[0]?.name : companies?.name;
      return {
        id: p.id as string,
        full_name: p.full_name as string,
        role: p.role as "admin" | "worker",
        company_name: companyName ?? "—",
        email,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  return NextResponse.json({ recipients });
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServer();
  const { profile } = await getSessionUser(supabase);
  if (!profile?.is_dev) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { subject, body, recipientIds, extraEmails, test } = (await request.json()) as {
    subject?: string;
    body?: string;
    recipientIds?: string[];
    extraEmails?: string[];
    test?: boolean;
  };

  if (!subject?.trim() || !body?.trim()) {
    return NextResponse.json({ error: "Subject and body are required" }, { status: 400 });
  }

  const fromAddress = process.env.MAILER_FROM_EMAIL;
  if (!process.env.RESEND_API_KEY || !fromAddress) {
    return NextResponse.json(
      { error: "Email sending is not configured (RESEND_API_KEY / MAILER_FROM_EMAIL)" },
      { status: 500 }
    );
  }

  // Test send: same template, same from-address, single recipient — lets you
  // see exactly what recipients will see before committing to the real send.
  if (test) {
    const resend = new Resend(process.env.RESEND_API_KEY);
    try {
      await resend.emails.send({
        from: fromAddress,
        to: [TEST_RECIPIENT],
        subject: `[TEST] ${subject}`,
        html: buildBroadcastHtml(body),
      });
      return NextResponse.json({ ok: true, test: true, sentTo: TEST_RECIPIENT });
    } catch (err) {
      console.error("Broadcast test send failed:", err);
      return NextResponse.json({ error: "Test send failed" }, { status: 500 });
    }
  }

  const cleanExtraEmails = (extraEmails ?? [])
    .map((e) => e.trim().toLowerCase())
    .filter((e) => EMAIL_RE.test(e));

  if (!recipientIds?.length && !cleanExtraEmails.length) {
    return NextResponse.json({ error: "Select at least one recipient" }, { status: 400 });
  }

  const admin = createSupabaseAdmin();

  let accountEmails: string[] = [];
  if (recipientIds?.length) {
    const { data: profiles, error: profilesError } = await admin
      .from("profiles")
      .select("id")
      .in("id", recipientIds);
    if (profilesError) {
      console.error("Broadcast: failed to load recipients", profilesError);
      return NextResponse.json({ error: "Failed to load recipients" }, { status: 500 });
    }

    let emailById: Map<string, string>;
    try {
      emailById = await loadEmailsById(admin);
    } catch (err) {
      console.error("Broadcast: failed to load user emails", err);
      return NextResponse.json({ error: "Failed to load user emails" }, { status: 500 });
    }

    accountEmails = (profiles ?? [])
      .map((p) => emailById.get(p.id))
      .filter((email): email is string => !!email);
  }

  const recipients = Array.from(new Set([...accountEmails, ...cleanExtraEmails]));

  if (!recipients.length) {
    return NextResponse.json({ ok: true, sent: 0, totalRecipients: 0 });
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  const html = buildBroadcastHtml(body);

  const BATCH_SIZE = 100;
  let sent = 0;
  let failedBatches = 0;
  for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
    const chunk = recipients.slice(i, i + BATCH_SIZE);
    const payload = chunk.map((email) => ({
      from: fromAddress,
      to: [email],
      subject,
      html,
    }));
    try {
      await resend.batch.send(payload);
      sent += chunk.length;
    } catch (err) {
      console.error("Broadcast batch failed:", err);
      failedBatches++;
    }
  }

  return NextResponse.json({ ok: true, sent, totalRecipients: recipients.length, failedBatches });
}
