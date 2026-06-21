import Image from "next/image";
import Link from "next/link";
import TimesheetForm from "@/components/TimesheetForm";
import TodaySchedule from "@/components/TodaySchedule";
import BottomNav from "@/components/BottomNav";

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50 overflow-x-hidden">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <Image src="/logo.webp" alt="Cumberland Earthworks" width={140} height={39} priority />
          <Link href="/admin" className="text-sm font-semibold text-gray-400 hover:text-gray-700 border border-gray-200 rounded-lg px-3 py-1.5">
            Admin
          </Link>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 pb-24 space-y-6">
        <TodaySchedule />
        <div className="border-t border-gray-200 pt-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-4">Log Today&apos;s Hours</p>
          <TimesheetForm />
        </div>
      </main>
      <BottomNav />
    </div>
  );
}
