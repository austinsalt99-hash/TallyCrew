import { redirect } from "next/navigation";
import { createSupabaseServer, getSessionUser } from "@/lib/supabase-server";
import BroadcastComposer from "@/components/BroadcastComposer";

export const metadata = {
  title: "Broadcast — TallyCrew",
};

export default async function InternalBroadcastPage() {
  const supabase = await createSupabaseServer();
  const { profile } = await getSessionUser(supabase);

  if (!profile?.is_dev) {
    redirect("/");
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-10">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Send a notice</h1>
        <p className="text-sm text-gray-500 mb-8">
          One-off email to TallyCrew accounts — for service/legal notices (Terms of Service
          updates, policy changes, etc.), not marketing.
        </p>
        <BroadcastComposer />
      </div>
    </main>
  );
}
