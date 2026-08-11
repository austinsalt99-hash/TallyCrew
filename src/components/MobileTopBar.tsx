"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";

export default function MobileTopBar() {
  const pathname = usePathname();
  if (pathname?.startsWith("/site")) return null;

  return (
    <div
      className="print:hidden md:hidden fixed top-0 left-0 right-0 z-20"
      style={{
        background: "#0A1172",
        paddingTop: "env(safe-area-inset-top)",
      }}
    >
      <div className="h-11 flex items-center justify-center">
        <div className="bg-white rounded-lg px-3 py-1.5 shadow-sm">
          <Image src="/tally-wordmark-orange.png" alt="TallyCrew" width={90} height={21} priority />
        </div>
      </div>
    </div>
  );
}
