import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SerwistProvider } from "@serwist/next/react";
import NativeAppInit from "@/components/NativeAppInit";
import MobileTopBar from "@/components/MobileTopBar";
import OfflineBanner from "@/components/OfflineBanner";
import OfflineNavigation from "@/components/OfflineNavigation";
import OfflinePreload from "@/components/OfflinePreload";
import SyncManager from "@/components/SyncManager";

export const metadata: Metadata = {
  title: "TallyCrew",
  description: "Daily hour log for TallyCrew",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        {/* Tag the installed app before first paint, so the web top bar never flashes in it. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(window.Capacitor&&window.Capacitor.isNativePlatform&&window.Capacitor.isNativePlatform()){document.documentElement.classList.add("native-app")}}catch(e){}`,
          }}
        />
      </head>
      <body className="bg-gray-100 min-h-screen">
        {/* @serwist/next's webpack build-time auto-registration (patching the
            "main-app" entry) silently no-ops under this Next.js version, so
            /sw.js was shipping but never getting registered. Register it
            explicitly instead. */}
        <SerwistProvider swUrl="/sw.js" disable={process.env.NODE_ENV !== "production"} reloadOnOnline={false} />
        <NativeAppInit />
        <MobileTopBar />
        <OfflineBanner />
        <OfflineNavigation />
        <OfflinePreload />
        <SyncManager />
        {children}
      </body>
    </html>
  );
}
