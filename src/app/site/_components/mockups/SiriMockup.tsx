export default function SiriMockup() {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 max-w-md">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-orange-500 flex items-center justify-center shrink-0">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="white">
            <path d="M12 2a3 3 0 00-3 3v7a3 3 0 006 0V5a3 3 0 00-3-3zm5 9a1 1 0 00-2 0 3 3 0 01-6 0 1 1 0 00-2 0 5 5 0 004 4.9V18H9a1 1 0 000 2h6a1 1 0 000-2h-2v-2.1A5 5 0 0017 11z"/>
          </svg>
        </div>
        <p className="text-xs font-semibold text-gray-400">Hey Siri</p>
      </div>

      <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-4 py-3 mb-4">
        <p className="text-sm text-gray-800">
          &ldquo;Add to my TallyCrew calendar — pour the foundation at the Miller site Thursday morning, need three guys.&rdquo;
        </p>
      </div>

      <div className="flex items-center gap-2 mb-3">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/><path d="M8 12l3 3 5-6"/>
        </svg>
        <p className="text-xs font-semibold text-green-600">Draft job added to Calendar</p>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
        <p className="text-xs font-semibold text-gray-900">Foundation Pour — Miller Site</p>
        <p className="text-[11px] text-gray-500 mt-0.5">Thu, Aug 6 · Morning · 3 workers needed</p>
        <p className="text-[10px] text-amber-700 font-medium mt-1.5">Unverified — review in Calendar</p>
      </div>
    </div>
  );
}
