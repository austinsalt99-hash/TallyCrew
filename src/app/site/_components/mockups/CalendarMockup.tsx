const DAYS = ["MON", "TUE", "WED", "THU", "FRI"];

const JOBS: Record<string, { label: string; color: string; time: string }[]> = {
  MON: [{ label: "Miller Residence", color: "bg-blue-600", time: "7:00a" }],
  TUE: [
    { label: "Miller Residence", color: "bg-blue-600", time: "7:00a" },
    { label: "Gravel Run — Site B", color: "bg-orange-500", time: "1:00p" },
  ],
  WED: [{ label: "Downtown Office Fit-Out", color: "bg-blue-600", time: "8:00a" }],
  THU: [{ label: "Foundation Pour — Miller", color: "bg-amber-400", time: "7:00a" }],
  FRI: [
    { label: "Downtown Office Fit-Out", color: "bg-blue-600", time: "8:00a" },
    { label: "Equipment Service", color: "bg-gray-400", time: "2:00p" },
  ],
};

export default function CalendarMockup() {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-bold text-gray-900">Week of Aug 3</p>
        <div className="flex items-center gap-1.5 text-gray-300">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 18l-6-6 6-6"/></svg>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 18l6-6-6-6"/></svg>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-2">
        {DAYS.map((day) => (
          <div key={day} className="min-w-0">
            <p className="text-[10px] font-semibold text-gray-400 mb-1.5 text-center">{day}</p>
            <div className="space-y-1.5">
              {JOBS[day].map((job, i) => (
                <div key={i} className={`${job.color} rounded-lg px-1.5 py-1.5 cursor-grab`}>
                  <p className="text-[8.5px] font-semibold text-white leading-tight line-clamp-2">{job.label}</p>
                  <p className="text-[8px] text-white/70 mt-0.5">{job.time}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-4 mt-4 pt-4 border-t border-gray-100">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-blue-600" />
          <span className="text-[10px] text-gray-500">Scheduled</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-amber-400" />
          <span className="text-[10px] text-gray-500">Draft (Siri)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-orange-500" />
          <span className="text-[10px] text-gray-500">Trucking</span>
        </div>
      </div>
    </div>
  );
}
