"use client";

import { useEffect } from "react";
import { initNativeApp } from "@/lib/capacitor";

export default function NativeAppInit() {
  useEffect(() => {
    initNativeApp();
  }, []);

  return null;
}
