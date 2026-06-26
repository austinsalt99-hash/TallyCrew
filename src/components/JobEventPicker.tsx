"use client";

export interface JobEvent {
  id: string;
  date: string;
  title: string;
  client?: string;
  start_time?: string;
  end_time?: string;
}

interface Props {
  events: JobEvent[];
  baseDate: string;
  weekOffset: number;
  onPrev: () => void;
  onNext: () => void;
  onSelect: (event: JobEvent) => void;
  onClose: () => void;
}

function getWeekBounds(baseDate: string, offset: number): { from: Date; to: Date } {
  const [y, mo, d] = baseDate.split("-").map(Number);
  const base = new Date(y, mo - 1, d);
  const day = base.getDay();
  const monday = new Date(base);
  monday.setDate(base.getDate() - ((day + 6) % 7) + offset * 7);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { from: monday, to: sunday };
}

function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatWeekLabel(from: Date, to: Date): string {
  const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${fmt(from)} – ${fmt(to)}`;
}

function formatDayHeading(dateStr: string): string {
  const [y, mo, d] = dateStr.split("-").map(Number);
  return new Date(y, mo - 1, d).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

function formatTime(t?: string): string {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ampm}`;
}

export default function JobEventPicker({ events, baseDate, weekOffset, onPrev, onNext, onSelect, onClose }: Props) {
  const { from, to } = getWeekBounds(baseDate, weekOffset);
  const fromISO = toISO(from);
  const toISO_ = toISO(to);

  const weekEvents = events.filter((e) => e.date >= fromISO && e.date <= toISO_);

  // Group by date
  const byDate: Record<string, JobEvent[]> = {};
  for (const e of weekEvents) {
    if (!byDate[e.date]) byDate[e.date] = [];
    byDate[e.date].push(e);
  }
  const sortedDates = Object.keys(byDate).sort();

  return (
    <div className="fixed inset-0 z-40">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/20" onClick={onClose} />

      {/* Panel — bottom sheet on mobile, right sidebar on desktop */}
      <div className="
        absolute inset-x-0 bottom-0 h-[58vh] rounded-t-2xl
        md:inset-x-auto md:right-0 md:top-0 md:bottom-0 md:h-auto md:w-[380px] md:rounded-none
        bg-white shadow-xl flex flex-col
      ">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 shrink-0">
          <span className="font-semibold text-gray-900 flex-1">Link to schedule</span>
          <div className="flex items-center gap-1">
            <button
              onClick={onPrev}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 font-bold"
            >
              ‹
            </button>
            <span className="text-xs text-gray-500 whitespace-nowrap px-1">
              {formatWeekLabel(from, to)}
            </span>
            <button
              onClick={onNext}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-500 font-bold"
            >
              ›
            </button>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 text-xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {sortedDates.length === 0 ? (
            <div className="flex items-center justify-center h-full text-sm text-gray-400">
              No events scheduled this week.
            </div>
          ) : (
            sortedDates.map((dateStr) => (
              <div key={dateStr}>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                  {formatDayHeading(dateStr)}
                </p>
                <div className="space-y-2">
                  {byDate[dateStr]
                    .slice()
                    .sort((a, b) => (a.start_time ?? "").localeCompare(b.start_time ?? ""))
                    .map((event) => (
                      <button
                        key={event.id}
                        type="button"
                        onClick={() => onSelect(event)}
                        className="w-full text-left bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 hover:bg-blue-100 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-semibold text-gray-900 text-sm">{event.title}</span>
                          {event.start_time && (
                            <span className="text-xs text-gray-500 shrink-0 mt-0.5">
                              {formatTime(event.start_time)}
                              {event.end_time && ` – ${formatTime(event.end_time)}`}
                            </span>
                          )}
                        </div>
                        {event.client && (
                          <p className="text-xs text-gray-500 mt-0.5">{event.client}</p>
                        )}
                      </button>
                    ))}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
