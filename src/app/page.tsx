import Image from "next/image";
import Link from "next/link";
import TimesheetForm from "@/components/TimesheetForm";
import TodaySchedule from "@/components/TodaySchedule";

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <Image src="/logo.webp" alt="Cumberland Earthworks" width={180} height={50} priority />
          <div className="flex items-center gap-4">
            <Link href="/schedule" className="text-sm font-semibold text-gray-500 hover:text-gray-900">
              Schedule →
            </Link>
            <Link href="/admin" className="text-sm font-semibold text-gray-400 hover:text-gray-700 border border-gray-200 rounded-lg px-3 py-1.5">
              Admin
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 pb-16 space-y-6">
        <TodaySchedule />
        <div className="border-t border-gray-200 pt-6">
          <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-4">Log Today&apos;s Hours</p>
          <TimesheetForm />
        </div>
      </main>
    </div>
  );
}
