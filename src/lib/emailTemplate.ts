import type { BillableEntryData } from "@/components/BillableEntry";
import type { NonBillableEntryData } from "@/components/NonBillableEntry";

function formatTime(t: string): string {
  if (!t) return "—";
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
}

function calcHours(start: string, end: string): string {
  if (!start || !end) return "—";
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const mins = eh * 60 + em - (sh * 60 + sm);
  if (mins <= 0) return "—";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

export function buildEmailHtml(params: {
  employeeName: string;
  date: string;
  billable: BillableEntryData[];
  nonBillable: NonBillableEntryData[];
  notes: string;
  totalBillableHours: number;
  totalNonBillableHours: number;
}): string {
  const { employeeName, date, billable, nonBillable, notes, totalBillableHours, totalNonBillableHours } = params;

  const billableRows = billable
    .filter((e) => e.client || e.description || e.startTime)
    .map(
      (e) => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">${e.client || "—"}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">${e.description || "—"}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">${formatTime(e.startTime)} – ${formatTime(e.endTime)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-weight:600;">${calcHours(e.startTime, e.endTime)}</td>
      </tr>`
    )
    .join("");

  const nonBillableRows = nonBillable
    .filter((e) => e.description || e.hours)
    .map(
      (e) => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">${e.description || "—"}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-weight:600;">${e.hours ? `${e.hours}h` : "—"}</td>
      </tr>`
    )
    .join("");

  return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"></head>
<body style="font-family:Arial,sans-serif;background:#f9fafb;margin:0;padding:24px;">
  <div style="max-width:600px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb;">

    <div style="background:#2563eb;color:#fff;padding:24px 28px;">
      <h1 style="margin:0;font-size:22px;">CEW Daily Hours</h1>
      <p style="margin:4px 0 0;opacity:0.85;font-size:15px;">${employeeName} &middot; ${date}</p>
    </div>

    <div style="padding:24px 28px;">

      <h2 style="font-size:16px;color:#1e40af;margin:0 0 12px;">Billable Hours</h2>
      ${
        billableRows
          ? `<table style="width:100%;border-collapse:collapse;font-size:14px;">
              <thead>
                <tr style="background:#eff6ff;">
                  <th style="padding:8px 12px;text-align:left;font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;">Client</th>
                  <th style="padding:8px 12px;text-align:left;font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;">Job</th>
                  <th style="padding:8px 12px;text-align:left;font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;">Time</th>
                  <th style="padding:8px 12px;text-align:left;font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;">Hours</th>
                </tr>
              </thead>
              <tbody>${billableRows}</tbody>
            </table>
            <p style="text-align:right;font-size:14px;color:#374151;margin:8px 0 0;"><strong>Total billable: ${totalBillableHours}h</strong></p>`
          : `<p style="color:#9ca3af;font-size:14px;">No billable entries.</p>`
      }

      <h2 style="font-size:16px;color:#ea580c;margin:24px 0 12px;">Non-Billable Time</h2>
      ${
        nonBillableRows
          ? `<table style="width:100%;border-collapse:collapse;font-size:14px;">
              <thead>
                <tr style="background:#fff7ed;">
                  <th style="padding:8px 12px;text-align:left;font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;">Description</th>
                  <th style="padding:8px 12px;text-align:left;font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;">Hours</th>
                </tr>
              </thead>
              <tbody>${nonBillableRows}</tbody>
            </table>
            <p style="text-align:right;font-size:14px;color:#374151;margin:8px 0 0;"><strong>Total non-billable: ${totalNonBillableHours}h</strong></p>`
          : `<p style="color:#9ca3af;font-size:14px;">No non-billable entries.</p>`
      }

      ${
        notes
          ? `<h2 style="font-size:16px;color:#374151;margin:24px 0 8px;">Notes</h2>
             <p style="font-size:14px;color:#4b5563;white-space:pre-wrap;margin:0;">${notes}</p>`
          : ""
      }

    </div>

    <div style="background:#f9fafb;padding:14px 28px;border-top:1px solid #e5e7eb;">
      <p style="margin:0;font-size:12px;color:#9ca3af;">Submitted via CEW Daily Hours &middot; ${new Date().toLocaleString()}</p>
    </div>
  </div>
</body>
</html>`;
}
