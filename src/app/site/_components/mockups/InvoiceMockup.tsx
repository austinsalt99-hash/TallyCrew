const LINES = [
  { label: "Framing — Labor (7.5 hrs @ $65/hr)", amount: "$487.50" },
  { label: "Trucking — Gravel delivery (18 loads @ $12)", amount: "$216.00" },
  { label: "Foundation Pour — Labor (24 hrs @ $65/hr)", amount: "$1,560.00" },
];

export default function InvoiceMockup() {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 max-w-md">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide">Invoice #1042</p>
          <p className="text-sm font-bold text-gray-900">Miller Residence</p>
        </div>
        <div className="bg-gray-100 rounded-full px-2.5 py-1">
          <span className="text-[10px] font-semibold text-gray-500">Draft</span>
        </div>
      </div>

      <div className="space-y-2 mb-4">
        {LINES.map((line) => (
          <div key={line.label} className="flex items-center justify-between text-xs">
            <span className="text-gray-500 pr-3">{line.label}</span>
            <span className="font-semibold text-gray-900 whitespace-nowrap">{line.amount}</span>
          </div>
        ))}
      </div>

      <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-400">Auto-filled from logged hours</span>
        <span className="text-sm font-bold text-gray-900">$2,263.50</span>
      </div>
    </div>
  );
}
