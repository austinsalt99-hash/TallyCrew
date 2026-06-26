"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import AdminBottomNav from "@/components/AdminBottomNav";
import { createSupabaseBrowser } from "@/lib/supabase-browser";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  const handleSignOut = async () => {
    const supabase = createSupabaseBrowser();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-gray-900 px-4 py-3 flex items-center justify-between">
        <Image src="/logo.webp" alt="Cumberland Earthworks" width={140} height={39} />
        <button
          onClick={handleSignOut}
          className="text-xs text-gray-400 hover:text-white transition-colors"
        >
          Sign out
        </button>
      </header>
      <main className="max-w-5xl mx-auto px-4 py-8 pb-28">{children}</main>
      <AdminBottomNav />
    </div>
  );
}
