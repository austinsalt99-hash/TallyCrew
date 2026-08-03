export default function TimesheetMockup() {
  return (
    <div className="h-full w-full bg-gray-50 text-[10px] flex flex-col">
      <div className="bg-navy-600 px-4 pt-8 pb-4">
        <p className="text-white/60 text-[9px] font-semibold">Tuesday, August 4</p>
        <p className="text-white text-sm font-bold">Today&apos;s Hours</p>
      </div>

      <div className="flex-1 px-3 py-3 space-y-2.5 overflow-hidden">
        <div className="bg-white rounded-xl border border-gray-200 p-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[8px] font-semibold text-blue-600 uppercase tracking-wide">Billable</span>
            <span className="text-[9px] font-bold text-gray-900">7.5 hrs</span>
          </div>
          <p className="text-[10px] font-semibold text-gray-900">Miller Residence — Framing</p>
          <p className="text-[9px] text-gray-400">7:00 AM – 2:30 PM</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[8px] font-semibold text-blue-600 uppercase tracking-wide">Billable · Trucking</span>
            <span className="text-[9px] font-bold text-gray-900">2.0 hrs</span>
          </div>
          <p className="text-[10px] font-semibold text-gray-900">Gravel delivery — Site B</p>
          <p className="text-[9px] text-gray-400">Truck #4 · 18 loads</p>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[8px] font-semibold text-orange-500 uppercase tracking-wide">Non-Billable</span>
            <span className="text-[9px] font-bold text-gray-900">0.5 hrs</span>
          </div>
          <p className="text-[10px] font-semibold text-gray-900">Equipment maintenance</p>
        </div>

        <div className="border-2 border-dashed border-gray-300 rounded-xl p-3 text-center">
          <span className="text-[9px] font-semibold text-gray-400">+ Add Entry</span>
        </div>
      </div>

      <div className="px-3 pb-4">
        <div className="bg-blue-600 rounded-xl py-2.5 text-center">
          <span className="text-white text-[10px] font-bold">Submit Day — 10.0 hrs</span>
        </div>
      </div>
    </div>
  );
}
