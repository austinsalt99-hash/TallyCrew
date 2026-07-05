"use client";

import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import AdminBottomNav from "@/components/AdminBottomNav";
import { createSupabaseBrowser } from "@/lib/supabase-browser";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const isDashboard = pathname === "/admin/home";

  const handleSignOut = async () => {
    const supabase = createSupabaseBrowser();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-gray-100 overflow-x-hidden">
      {!isDashboard && (
        <header className="hidden md:flex bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm px-4 py-3 items-center justify-between">
          <Image src="/tally-wordmark.png" alt="TallyCrew" width={160} height={38} />
          <button onClick={handleSignOut} className="text-xs text-gray-500 hover:text-gray-900 transition-colors">
            Sign out
          </button>
        </header>
      )}
      <main className="max-w-5xl mx-auto px-4 py-8" style={{ paddingBottom: "calc(7rem + env(safe-area-inset-bottom))" }}>{children}</main>
      <AdminBottomNav />
    </div>
  );
}
