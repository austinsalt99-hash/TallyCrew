// Shared shapes for expenses — see supabase-schema.sql section 28 for the
// two places this data lives: the `expenses` table (admin-entered, from a
// quote's private notes, a job's calendar panel, or an invoice) and the
// `expenses` array embedded on a timesheet's billable entry (employee-
// logged, carried in submissions.billable_entries like hours are).

export type ExpenseCategory = "materials" | "equipment" | "subcontractor" | "other";

export const EXPENSE_CATEGORIES: { value: ExpenseCategory; label: string }[] = [
  { value: "materials", label: "Materials" },
  { value: "equipment", label: "Equipment / fuel" },
  { value: "subcontractor", label: "Subcontractor" },
  { value: "other", label: "Other" },
];

export function categoryLabel(c: string): string {
  return EXPENSE_CATEGORIES.find((e) => e.value === c)?.label ?? "Other";
}

// A row from the `expenses` table, or an expense found embedded in a
// timesheet entry — normalized to one shape so a list can show both
// together (see ExpensesCard).
export interface ExpenseItem {
  id: string;
  source: "manual" | "timesheet";
  amount: number;
  category: ExpenseCategory;
  note: string | null;
  date: string;
  jobId?: string | null;
  jobTitle?: string | null;
  employeeName?: string | null;
  // The submission a timesheet-logged one lives on — needed to find and
  // remove it from that submission's billable_entries (see DELETE /api/expenses).
  submissionId?: string;
  removable: boolean;
}

// The shape of one entry in BillableEntryData.expenses (src/components/BillableEntry.tsx).
export interface ExpenseLine {
  id: string;
  amount?: number;
  category: ExpenseCategory;
  note?: string;
}
