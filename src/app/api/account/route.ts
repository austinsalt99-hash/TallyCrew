import { NextResponse } from "next/server";
import { createSupabaseServer, getSessionUser } from "@/lib/supabase-server";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

// Self-service account deletion (Apple Guideline 5.1.1(v) requires this for
// any app that supports account creation). This deletes the actual
// auth.users row — not a deactivation flag — which cascades to the profiles
// row. Historical business records (submissions, invoices, announcements,
// etc.) are kept: the schema's account-deletion migration (supabase-schema.sql
// section 21) points the relevant foreign keys at ON DELETE SET NULL instead
// of the default RESTRICT, so e.g. a timesheet keeps its employee_name and
// hours but its user_id link goes null, rather than the delete failing or
// the timesheet vanishing.
export async function DELETE() {
  const supabase = await createSupabaseServer();
  const { user, profile } = await getSessionUser(supabase);
  if (!user || !profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createSupabaseAdmin();
  const { error } = await admin.auth.admin.deleteUser(user.id);

  if (error) {
    console.error("Account deletion failed:", error);
    return NextResponse.json(
      { error: "Could not delete your account. Please try again or contact support." },
      { status: 500 }
    );
  }

  return new NextResponse(null, { status: 204 });
}
