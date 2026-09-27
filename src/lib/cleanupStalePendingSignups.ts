import { SupabaseClient } from "@supabase/supabase-js";

// Deletes company signups that never finished Stripe checkout — still
// subscription_status "pending" — and are older than the grace window
// below. A retry with the same email is already handled instantly at
// registration time (see /api/auth/register-company); this is just the
// backstop for abandoned attempts nobody ever retries, so the companies
// table doesn't accumulate dead rows and stays a clean list of real
// accounts. "pending" is a one-way status: any company that has ever
// completed, failed, or canceled a Stripe interaction has a different
// status forever, so this can never touch an active, trialing, past-due,
// or canceled account — only ones that never reached Stripe at all.
//
// Piggybacks on an existing daily cron (see src/app/api/cron/reminders)
// rather than its own cron entry, since Vercel's Hobby plan caps a
// project at 2 cron jobs.
const PENDING_GRACE_HOURS = 24;

export async function cleanupStalePendingSignups(admin: SupabaseClient<any>): Promise<number> {
  const cutoff = new Date(Date.now() - PENDING_GRACE_HOURS * 3600000).toISOString();

  const { data: staleCompanies, error: fetchError } = await admin
    .from("companies")
    .select("id")
    .eq("subscription_status", "pending")
    .lt("created_at", cutoff);

  if (fetchError) {
    console.error("[cleanupStalePendingSignups] fetch error:", fetchError);
    return 0;
  }
  if (!staleCompanies?.length) return 0;

  let cleaned = 0;

  for (const company of staleCompanies) {
    const { data: profiles } = await admin
      .from("profiles")
      .select("id")
      .eq("company_id", company.id);

    // Delete the login(s) first — this cascades their profile row — so the
    // company row has no remaining profiles pointing at it before we delete it.
    let allUsersDeleted = true;
    for (const profile of profiles ?? []) {
      const { error: deleteUserError } = await admin.auth.admin.deleteUser(profile.id);
      if (deleteUserError) {
        console.error("[cleanupStalePendingSignups] failed to delete user:", profile.id, deleteUserError);
        allUsersDeleted = false;
      }
    }
    if (!allUsersDeleted) continue; // leave the company for the next run rather than orphan it

    const { error: deleteCompanyError } = await admin.from("companies").delete().eq("id", company.id);
    if (deleteCompanyError) {
      console.error("[cleanupStalePendingSignups] failed to delete company:", company.id, deleteCompanyError);
      continue;
    }

    cleaned++;
  }

  return cleaned;
}
