import { Capacitor } from "@capacitor/core";
import { initNotifications } from "./notifications";

export async function initNativeApp() {
  if (!Capacitor.isNativePlatform()) return;

  const [{ StatusBar, Style }, { Keyboard }] = await Promise.all([
    import("@capacitor/status-bar"),
    import("@capacitor/keyboard"),
  ]);

  await StatusBar.setStyle({ style: Style.Dark });
  await StatusBar.setBackgroundColor({ color: "#ffffff" });

  Keyboard.addListener("keyboardWillShow", () => {
    document.body.style.paddingBottom = "0";
  });

  await initNotifications();
}
