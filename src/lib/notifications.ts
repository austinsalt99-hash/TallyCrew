import { Capacitor } from "@capacitor/core";

let initialized = false;

export async function initNotifications(): Promise<void> {
  if (!Capacitor.isNativePlatform() || initialized) return;
  initialized = true;

  try {
    const { default: OneSignal } = await import("@onesignal/capacitor-plugin");
    await OneSignal.initialize(process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID!);
    await OneSignal.Notifications.requestPermission(true);
  } catch (err) {
    console.error("[notifications] init error:", err);
  }
}

export async function identifyUser(userId: string, companyId: string): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  try {
    const { default: OneSignal } = await import("@onesignal/capacitor-plugin");
    await OneSignal.login(userId);
    await OneSignal.User.addTag("company_id", companyId);
  } catch (err) {
    console.error("[notifications] identifyUser error:", err);
  }
}

export async function clearUser(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  try {
    const { default: OneSignal } = await import("@onesignal/capacitor-plugin");
    await OneSignal.logout();
  } catch (err) {
    console.error("[notifications] clearUser error:", err);
  }
}
