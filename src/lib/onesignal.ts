const APP_ID = process.env.ONESIGNAL_APP_ID!;
const REST_KEY = process.env.ONESIGNAL_REST_API_KEY!;
const API_URL = "https://onesignal.com/api/v1/notifications";

async function send(payload: Record<string, unknown>): Promise<void> {
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${REST_KEY}`,
      },
      body: JSON.stringify({ app_id: APP_ID, ...payload }),
    });
    if (!res.ok) {
      const text = await res.text();
      console.error("[OneSignal] send failed:", res.status, text);
    }
  } catch (err) {
    console.error("[OneSignal] send error:", err);
  }
}

export async function sendToUser(
  externalUserId: string,
  title: string,
  body: string
): Promise<void> {
  await send({
    include_external_user_ids: [externalUserId],
    channel_for_external_user_ids: "push",
    headings: { en: title },
    contents: { en: body },
  });
}

export async function sendToCompany(
  companyId: string,
  title: string,
  body: string
): Promise<void> {
  await send({
    filters: [{ field: "tag", key: "company_id", relation: "=", value: companyId }],
    headings: { en: title },
    contents: { en: body },
  });
}
