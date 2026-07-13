import type { Metadata, Viewport } from "next";
import "./globals.css";
import NativeAppInit from "@/components/NativeAppInit";

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
      <body className="bg-gray-100 min-h-screen">
        <NativeAppInit />
        {children}
      </body>
    </html>
  );
}
