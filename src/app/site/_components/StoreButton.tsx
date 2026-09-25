"use client";

import { useEffect, useState } from "react";
import { APP_STORE_URL, PLAY_STORE_URL } from "../_lib/constants";

function isAndroidVisitor(): boolean {
  return typeof navigator !== "undefined" && /android/i.test(navigator.userAgent);
}

// A single "get the app" button that quietly does the right thing once an
// Android build exists. Server-rendered output always points at the App
// Store — navigator.userAgent doesn't exist on the server, and rendering
// something different there than on the client's first paint would trigger
// a hydration mismatch. The useEffect below only runs after mount (client
// only), so it's safe to flip the link there once we can actually check.
//
// Until PLAY_STORE_URL is filled in (see _lib/constants.ts), this is a
// no-op and everyone gets the App Store link, Android visitors included.
export default function StoreButton({
  className,
  iosLabel = "View in App Store",
  androidLabel = "Get it on Google Play",
}: {
  className: string;
  iosLabel?: string;
  androidLabel?: string;
}) {
  const [isAndroid, setIsAndroid] = useState(false);

  useEffect(() => {
    if (PLAY_STORE_URL && isAndroidVisitor()) setIsAndroid(true);
  }, []);

  const useAndroid = isAndroid && !!PLAY_STORE_URL;

  return (
    <a
      href={useAndroid ? PLAY_STORE_URL! : APP_STORE_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={className}
    >
      {useAndroid ? androidLabel : iosLabel}
    </a>
  );
}
