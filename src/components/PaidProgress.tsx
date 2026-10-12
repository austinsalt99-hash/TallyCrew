import { formatMoney } from "@/app/admin/invoices/_components/invoiceFormat";

// "$500 of $2,000 paid" with a thin bar. Green once it's paid in full.
export default function PaidProgress({ paid, total, compact = false }: { paid: number; total: number; compact?: boolean }) {
  const full = total > 0 && paid + 0.005 >= total;
  const pct = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : paid > 0 ? 100 : 0;
  return (
    <div className={compact ? "w-full" : "w-full space-y-1.5"}>
      <div className={`flex justify-between gap-2 ${compact ? "text-[11px]" : "text-xs"}`}>
        <span className={full ? "text-green-700 font-semibold" : "text-gray-500"}>
          {full ? "Paid in full" : paid > 0 ? `${formatMoney(paid)} of ${formatMoney(total)} paid` : "Nothing paid yet"}
        </span>
        {!full && paid > 0 && !compact && <span className="text-gray-500">{formatMoney(Math.max(0, total - paid))} left</span>}
      </div>
      <div className={`w-full bg-gray-100 rounded-full overflow-hidden ${compact ? "h-1 mt-1" : "h-1.5"}`}>
        <div className={`h-full rounded-full ${full ? "bg-green-500" : "bg-navy-500"}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
