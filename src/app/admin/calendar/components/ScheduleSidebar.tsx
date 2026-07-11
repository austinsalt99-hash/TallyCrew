"use client";

import { ALL_TYPE_CONFIGS } from "../constants/eventTypes";

const TYPE_ORDER = ["job", "draft-job", "meeting", "site-visit", "task", "reminder", "note"] as const;

// Small inline SVG icons keyed by type
function TypeIcon({ type, color }: { type: string; color: string }) {
  const cls = `flex-shrink-0`;
  if (type === "job" || type === "draft-job") return (
    <svg className={cls} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
    </svg>
  );
  if (type === "meeting") return (
    <svg className={cls} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
    </svg>
  );
  if (type === "site-visit") return (
    <svg className={cls} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
    </svg>
  );
  if (type === "task") return (
    <svg className={cls} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/>
    </svg>
  );
  if (type === "reminder") return (
    <svg className={cls} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>
    </svg>
  );
  return (
    <svg className={cls} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>
    </svg>
  );
}

interface ScheduleSidebarProps {
  visibleTypes: Set<string>;
  onToggleType: (type: string) => void;
  filterEmployee: string;
  onEmployeeFilterChange: (v: string) => void;
  filterStatus: "all" | "verified" | "unverified";
  onStatusFilterChange: (v: "all" | "verified" | "unverified") => void;
  workerNames: string[];
  onQuickAdd: (type: string) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export default function ScheduleSidebar({
  visibleTypes,
  onToggleType,
  filterEmployee,
  onEmployeeFilterChange,
  filterStatus,
  onStatusFilterChange,
  workerNames,
  onQuickAdd,
  isCollapsed,
  onToggleCollapse,
}: ScheduleSidebarProps) {
  if (isCollapsed) {
    return (
      <div className="flex flex-col items-center gap-2 py-3 px-1.5 bg-white rounded-2xl border border-gray-200 shadow-sm w-9 flex-shrink-0">
        <button
          onClick={onToggleCollapse}
          className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors"
          title="Expand sidebar"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </button>
        <div className="w-px h-4 bg-gray-200" />
        {TYPE_ORDER.map((type) => {
          const cfg = ALL_TYPE_CONFIGS[type];
          const active = visibleTypes.has(type);
          return (
            <button
              key={type}
              onClick={() => onToggleType(type)}
              title={cfg.label}
              className="w-5 h-5 rounded-full flex-shrink-0 transition-opacity"
              style={{ backgroundColor: cfg.color, opacity: active ? 1 : 0.25 }}
            />
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4 bg-white rounded-2xl border border-gray-200 shadow-sm w-52 flex-shrink-0 self-start">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Calendar</span>
        <button
          onClick={onToggleCollapse}
          className="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors rounded-lg hover:bg-gray-100"
          title="Collapse sidebar"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
      </div>

      {/* Event type toggles */}
      <div>
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Event Types</p>
        <div className="space-y-1">
          {TYPE_ORDER.map((type) => {
            const cfg = ALL_TYPE_CONFIGS[type];
            const active = visibleTypes.has(type);
            return (
              <button
                key={type}
                onClick={() => onToggleType(type)}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-gray-50 transition-colors text-left group"
              >
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0 transition-opacity" style={{ backgroundColor: cfg.color, opacity: active ? 1 : 0.3 }} />
                <span className={`text-xs font-medium flex-1 truncate transition-colors ${active ? "text-gray-700" : "text-gray-400"}`}>{cfg.label}</span>
                {/* Toggle pill */}
                <div className={`w-7 h-3.5 rounded-full transition-colors flex-shrink-0 relative ${active ? "bg-navy-500" : "bg-gray-200"}`}>
                  <div className={`absolute top-0.5 w-2.5 h-2.5 rounded-full bg-white shadow transition-transform ${active ? "translate-x-3.5" : "translate-x-0.5"}`} />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Quick Add */}
      <div>
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Quick Add</p>
        <div className="space-y-1">
          {TYPE_ORDER.map((type) => {
            const cfg = ALL_TYPE_CONFIGS[type];
            if (type === "draft-job") return null; // Can't manually create a draft job
            return (
              <button
                key={type}
                onClick={() => onQuickAdd(type)}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-xl hover:bg-gray-50 transition-colors text-left"
              >
                <TypeIcon type={type} color={cfg.color} />
                <span className="text-xs text-gray-600">+ {cfg.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Filters */}
      <div>
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Filters</p>
        <div className="space-y-2">
          <select
            value={filterEmployee}
            onChange={(e) => onEmployeeFilterChange(e.target.value)}
            className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 text-gray-600 bg-white focus:outline-none focus:ring-1 focus:ring-navy-400"
          >
            <option value="">All Employees</option>
            {workerNames.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
          <div className="flex rounded-lg border border-gray-200 overflow-hidden">
            {(["all", "verified", "unverified"] as const).map((s) => (
              <button
                key={s}
                onClick={() => onStatusFilterChange(s)}
                className={`flex-1 py-1 text-[10px] font-semibold transition-colors ${filterStatus === s ? "bg-navy-600 text-white" : "bg-white text-gray-500 hover:bg-gray-50"}`}
              >
                {s === "all" ? "All" : s === "verified" ? "Active" : "Draft"}
              </button>
            ))}
          </div>
          {(filterEmployee || filterStatus !== "all") && (
            <button
              onClick={() => { onEmployeeFilterChange(""); onStatusFilterChange("all"); }}
              className="text-[10px] text-gray-400 hover:text-gray-600 font-medium"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
