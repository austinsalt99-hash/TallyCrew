// src/app/admin/calendar/constants/eventTypes.ts

export const EVENT_TYPES = {
  meeting:      { label: "Meeting",    color: "#7c3aed", bg: "#ede9fe", dot: "bg-violet-400" },
  "site-visit": { label: "Site Visit", color: "#ea580c", bg: "#ffedd5", dot: "bg-orange-400" },
  task:         { label: "Task",       color: "#16a34a", bg: "#dcfce7", dot: "bg-green-400" },
  reminder:     { label: "Reminder",   color: "#d97706", bg: "#fef3c7", dot: "bg-amber-400" },
  note:         { label: "Note",       color: "#2563eb", bg: "#dbeafe", dot: "bg-blue-400" },
} as const;

export type EventType = keyof typeof EVENT_TYPES;

export const JOB_TYPE_CONFIG = {
  job:        { label: "Jobs",       color: "#F4A823", bg: "#FFF8EC" },
  "draft-job":{ label: "Draft Jobs", color: "#9ca3af", bg: "#f3f4f6" },
} as const;

export type UnifiedEventType = EventType | "job" | "draft-job";

export const ALL_TYPE_CONFIGS: Record<string, { label: string; color: string; bg: string }> = {
  job:          { label: "Jobs",       color: "#F4A823", bg: "#FFF8EC" },
  "draft-job":  { label: "Draft Jobs", color: "#9ca3af", bg: "#f3f4f6" },
  ...Object.fromEntries(
    Object.entries(EVENT_TYPES).map(([k, v]) => [k, { label: v.label, color: v.color, bg: v.bg }])
  ),
};

export interface PlanEvent {
  id: string;
  title: string;
  event_type: EventType;
  date: string;
  start_time: string;
  end_time: string;
  description: string;
  location: string;
  attendees: string;
  is_done: boolean;
}
