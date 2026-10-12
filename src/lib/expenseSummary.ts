// Timesheet-side half of expenses (see supabase-schema.sql section 28 and
// src/types/expense.ts). An employee's expense pill lives embedded on the
// billable entry, same as hours — this walks submissions the same way
// payrollSummary.ts does for hours, and normalizes what it finds into
// ExpenseItem so it can sit in the same list as `expenses` table rows.
import { SupabaseClient } from "@supabase/supabase-js";
import type { ExpenseCategory, ExpenseItem, ExpenseLine } from "@/types/expense";

function normalizeLines(
  lines: unknown,
  date: string,
  employeeName: string,
  jobId: string | null,
  jobTitle: string | null,
  submissionId: string,
): ExpenseItem[] {
  if (!Array.isArray(lines)) return [];
  return (lines as ExpenseLine[])
    .filter((l) => l && typeof l.amount === "number" && l.amount > 0)
    .map((l) => ({
      id: l.id,
      source: "timesheet" as const,
      amount: l.amount as number,
      category: (l.category as ExpenseCategory) ?? "other",
      note: l.note?.trim() || null,
      date,
      jobId,
      jobTitle,
      employeeName,
      submissionId,
      // Admins can remove these too (viewing the job or the invoice) — it's
      // a DELETE on the submission's billable_entries, not the expenses table.
      removable: true,
    }));
}

// Every employee-logged expense in a date range (by submission date, not
// deleted) — the Financials page's half of the expenses total.
export async function aggregateTimesheetExpenses(
  supabase: SupabaseClient<any>,
  companyId: string,
  start: string,
  end: string,
): Promise<ExpenseItem[]> {
  const { data: submissions } = await supabase
    .from("submissions")
    .select("id, employee_name, date, billable_entries")
    .eq("company_id", companyId)
    .is("deleted_at", null)
    .gte("date", start)
    .lte("date", end);

  const items: ExpenseItem[] = [];
  for (const sub of submissions ?? []) {
    const entries = (sub.billable_entries as Record<string, unknown>[]) ?? [];
    for (const entry of entries) {
      items.push(
        ...normalizeLines(
          entry.expenses,
          sub.date as string,
          sub.employee_name as string,
          (entry.linkedEventId as string) ?? null,
          (entry.linkedEventTitle as string) ?? null,
          sub.id as string,
        )
      );
    }
  }
  return items;
}

// Employee-logged expenses linked to any of these jobs — used by a job's
// calendar panel and by an invoice (which rolls up its linked jobs' costs).
// Looked up per job id the same way GET /api/submissions?eventId= does,
// since JSONB containment only matches one value at a time.
export async function timesheetExpensesForJobIds(
  supabase: SupabaseClient<any>,
  companyId: string,
  jobIds: string[],
): Promise<ExpenseItem[]> {
  if (jobIds.length === 0) return [];
  const items: ExpenseItem[] = [];
  for (const jobId of jobIds) {
    const { data: submissions } = await supabase
      .from("submissions")
      .select("id, employee_name, date, billable_entries")
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .filter("billable_entries", "cs", JSON.stringify([{ linkedEventId: jobId }]));

    for (const sub of submissions ?? []) {
      const entries = (sub.billable_entries as Record<string, unknown>[]) ?? [];
      for (const entry of entries) {
        if (entry.linkedEventId !== jobId) continue;
        items.push(
          ...normalizeLines(
            entry.expenses,
            sub.date as string,
            sub.employee_name as string,
            jobId,
            (entry.linkedEventTitle as string) ?? null,
            sub.id as string,
          )
        );
      }
    }
  }
  return items;
}

// Removes one employee-logged expense line from wherever it lives in a
// submission's billable_entries. Used by DELETE /api/expenses for
// source: "timesheet" rows (there's no table row to delete — the data is
// on the submission, same as hours). Returns false if nothing matched.
export async function deleteTimesheetExpense(
  supabase: SupabaseClient<any>,
  companyId: string,
  submissionId: string,
  expenseLineId: string,
): Promise<boolean> {
  const { data: sub } = await supabase
    .from("submissions")
    .select("billable_entries")
    .eq("id", submissionId)
    .eq("company_id", companyId)
    .maybeSingle();
  if (!sub) return false;

  const entries = (sub.billable_entries as Record<string, unknown>[]) ?? [];
  let changed = false;
  const updated = entries.map((entry) => {
    const expenses = (entry.expenses as ExpenseLine[] | undefined) ?? [];
    if (!expenses.some((e) => e.id === expenseLineId)) return entry;
    changed = true;
    return { ...entry, expenses: expenses.filter((e) => e.id !== expenseLineId) };
  });
  if (!changed) return false;

  const { error } = await supabase
    .from("submissions")
    .update({ billable_entries: updated })
    .eq("id", submissionId)
    .eq("company_id", companyId);
  return !error;
}
