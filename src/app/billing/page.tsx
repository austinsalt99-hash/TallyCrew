import { redirect } from "next/navigation";
import { createSupabaseServer, getSessionUser } from "@/lib/supabase-server";
import BillingClient from "./BillingClient";

export default async function BillingPage() {
  const supabase = await createSupabaseServer();
  const { user, profile } = await getSessionUser(supabase);

  if (!user || !profile) {
    redirect("/login");
  }

  const { data: company } = await supabase
    .from("companies")
    .select("plan_tier")
    .eq("id", profile.company_id)
    .single();

  return <BillingClient planTier={company?.plan_tier ?? null} />;
}
