export default function LogTypeBuilderMockup() {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 max-w-md">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide">Log Config</p>
          <p className="text-sm font-bold text-gray-900">Trucking</p>
        </div>
        <div className="flex items-center gap-1.5 bg-green-50 border border-green-200 rounded-full px-2.5 py-1">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
          <span className="text-[10px] font-semibold text-green-700">Active</span>
        </div>
      </div>

      <div className="space-y-2.5">
        <div className="flex items-center justify-between border border-gray-200 rounded-xl px-3 py-2.5">
          <div>
            <p className="text-xs font-semibold text-gray-900">Truck #</p>
            <p className="text-[10px] text-gray-400">Dropdown · Required</p>
          </div>
          <span className="text-[10px] text-gray-400">#4</span>
        </div>

        <div className="flex items-center justify-between border border-gray-200 rounded-xl px-3 py-2.5">
          <div>
            <p className="text-xs font-semibold text-gray-900">Load Type</p>
            <p className="text-[10px] text-gray-400">Dropdown · Gravel, Sand, Fill</p>
          </div>
          <span className="text-[10px] text-gray-400">Gravel</span>
        </div>

        <div className="flex items-center justify-between border border-gray-200 rounded-xl px-3 py-2.5">
          <div>
            <p className="text-xs font-semibold text-gray-900">Loads Hauled</p>
            <p className="text-[10px] text-gray-400">Number · $12.00 per unit</p>
          </div>
          <span className="text-[10px] text-gray-400">18</span>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between">
        <span className="text-[11px] font-medium text-gray-500">Timed per job</span>
        <div className="w-9 h-5 bg-blue-600 rounded-full flex items-center px-0.5 justify-end">
          <span className="w-4 h-4 bg-white rounded-full" />
        </div>
      </div>
    </div>
  );
}
