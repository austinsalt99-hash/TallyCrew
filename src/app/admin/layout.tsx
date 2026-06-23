"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Image from "next/image";
import { isLoggedIn } from "@/lib/auth";
import AdminBottomNav from "@/components/AdminBottomNav";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    if (pathname === "/admin") {
      setChecked(true);
      return;
    }
    if (!isLoggedIn()) {
      router.replace("/admin");
    } else {
      setChecked(true);
    }
  }, [pathname, router]);

  if (!checked) return null;

  if (pathname === "/admin") return <>{children}</>;

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-gray-900 px-4 py-3 flex items-center">
        <Image src="/logo.webp" alt="Cumberland Earthworks" width={140} height={39} />
      </header>
      <main className="max-w-5xl mx-auto px-4 py-8 pb-28">{children}</main>
      <AdminBottomNav />
    </div>
  );
}
