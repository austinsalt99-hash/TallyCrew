"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { isLoggedIn, clearToken } from "@/lib/auth";

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
      <nav className="bg-gray-900 text-white px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Image src="/logo.webp" alt="Cumberland Earthworks" width={140} height={39} className="brightness-0 invert" />
          <Link
            href="/admin/dashboard"
            className={`text-sm ${pathname === "/admin/dashboard" ? "text-white font-semibold" : "text-gray-400 hover:text-white"}`}
          >
            Hour Logs
          </Link>
          <Link
            href="/admin/calendar"
            className={`text-sm ${pathname === "/admin/calendar" ? "text-white font-semibold" : "text-gray-400 hover:text-white"}`}
          >
            Calendar
          </Link>
          <Link
            href="/admin/log-config"
            className={`text-sm ${pathname === "/admin/log-config" ? "text-white font-semibold" : "text-gray-400 hover:text-white"}`}
          >
            Log Types
          </Link>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/" className="text-gray-400 hover:text-white text-sm">
            Employee Site
          </Link>
          <button
            onClick={() => { clearToken(); router.push("/admin"); }}
            className="text-gray-400 hover:text-white text-sm"
          >
            Sign Out
          </button>
        </div>
      </nav>
      <main className="max-w-5xl mx-auto px-4 py-8">{children}</main>
    </div>
  );
}
