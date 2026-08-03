"use client";

import { useState } from "react";
import Link from "next/link";
import { REGISTER_URL } from "../_lib/constants";

type LogTypeKey = "labor" | "trucking" | "machine";

const LOG_TYPES: Record<LogTypeKey, { label: string; color: string; fields: string[]; rateNote: string }> = {
  labor: { label: "General Labor", color: "text-blue-600 bg-blue-50", fields: ["Job / Client", "Hours"], rateNote: "Billed hourly" },
  trucking: { label: "Trucking", color: "text-orange-500 bg-orange-50", fields: ["Truck #", "Load Type", "Loads Hauled"], rateNote: "$12.00 per load" },
  machine: { label: "Machine Operating", color: "text-purple-600 bg-purple-50", fields: ["Machine", "Hours"], rateNote: "$85.00 per hour" },
};

interface Entry {
  id: number;
  type: LogTypeKey;
  summary: string;
  detail: string;
}

interface DraftJob {
  id: number;
  title: string;
  when: string;
}

function parseSiriPhrase(text: string): DraftJob {
  const lower = text.toLowerCase();

  const dayMatch = lower.match(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|tomorrow|today)\b/);
  const timeMatch = lower.match(/\b(morning|afternoon|evening|\d{1,2}(?::\d{2})?\s?(?:am|pm))\b/);

  let site = "the job site";
  const atMatch = text.match(/\bat (?:the )?([a-z0-9' ]+?)(?:\.|,| on | this | next |$)/i);
  if (atMatch) site = atMatch[1].trim();

  let action = "New job";
  const verbMatch = lower.match(/\b(pour|frame|deliver|install|dig|grade|paint|repair|inspect)\w*/);
  if (verbMatch) {
    const verb = verbMatch[1];
    action = verb.charAt(0).toUpperCase() + verb.slice(1) + (verb.endsWith("e") ? "" : "ing").replace("ee", "e");
  }

  const title = `${action} — ${site.charAt(0).toUpperCase() + site.slice(1)}`;
  const when = [dayMatch?.[1], timeMatch?.[1]].filter(Boolean).join(" · ") || "Today";

  return { id: Date.now(), title, when };
}

export default function DemoPage() {
  const [activeType, setActiveType] = useState<LogTypeKey>("labor");
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [entries, setEntries] = useState<Entry[]>([
    { id: 1, type: "labor", summary: "Miller Residence — Framing", detail: "7.5 hrs" },
  ]);

  const [siriText, setSiriText] = useState("pour the foundation at the Miller site tomorrow morning");
  const [drafts, setDrafts] = useState<DraftJob[]>([]);

  const type = LOG_TYPES[activeType];

  function handleFieldChange(field: string, value: string) {
    setFieldValues((prev) => ({ ...prev, [field]: value }));
  }

  function handleAddEntry() {
    const values = type.fields.map((f) => fieldValues[f]).filter(Boolean);
    if (values.length === 0) return;
    setEntries((prev) => [
      ...prev,
      { id: Date.now(), type: activeType, summary: values[0], detail: values.slice(1).join(" · ") || type.rateNote },
    ]);
    setFieldValues({});
  }

  function handleParseSiri() {
    if (!siriText.trim()) return;
    setDrafts((prev) => [parseSiriPhrase(siriText), ...prev]);
  }

  return (
    <>
      <section className="bg-gradient-to-b from-navy-900 to-navy-600 py-14 md:py-16">
        <div className="max-w-4xl mx-auto px-5 text-center">
          <h1 className="font-display text-3xl md:text-4xl font-bold text-white mb-3">Try TallyCrew, right here</h1>
          <p className="text-navy-100 max-w-lg mx-auto">
            This is a sandbox with sample data — nothing you do here touches a real account. Log an entry, or try the
            Siri voice-to-job flow below.
          </p>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-5 py-14 md:py-16 grid md:grid-cols-2 gap-8">
        {/* Log an entry */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Step 1</p>
          <h2 className="font-display text-xl font-bold text-gray-900 mb-4">Log an hours entry</h2>

          <div className="flex gap-2 mb-5 flex-wrap">
            {(Object.keys(LOG_TYPES) as LogTypeKey[]).map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => { setActiveType(key); setFieldValues({}); }}
                className={`text-xs font-semibold rounded-full px-3 py-1.5 border transition-colors ${
                  activeType === key
                    ? "bg-navy-600 border-navy-600 text-white"
                    : "bg-white border-gray-200 text-gray-500 hover:border-gray-300"
                }`}
              >
                {LOG_TYPES[key].label}
              </button>
            ))}
          </div>

          <div className="space-y-3 mb-5">
            {type.fields.map((field) => (
              <div key={field}>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">{field}</label>
                <input
                  type="text"
                  value={fieldValues[field] ?? ""}
                  onChange={(e) => handleFieldChange(field, e.target.value)}
                  placeholder={`Enter ${field.toLowerCase()}`}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                />
              </div>
            ))}
            <p className="text-[11px] text-gray-400">{type.rateNote}</p>
          </div>

          <button
            type="button"
            onClick={handleAddEntry}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl py-3 text-sm transition-colors"
          >
            Add Entry
          </button>

          <div className="mt-5 pt-5 border-t border-gray-100 space-y-2">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Today&apos;s Log</p>
            {entries.map((e) => (
              <div key={e.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2.5">
                <div>
                  <p className={`text-[10px] font-semibold uppercase tracking-wide inline-block rounded px-1.5 py-0.5 mb-1 ${LOG_TYPES[e.type].color}`}>
                    {LOG_TYPES[e.type].label}
                  </p>
                  <p className="text-sm font-medium text-gray-800">{e.summary}</p>
                </div>
                <span className="text-xs text-gray-400 whitespace-nowrap pl-2">{e.detail}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Siri */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Step 2</p>
          <h2 className="font-display text-xl font-bold text-gray-900 mb-4">Try the Siri Shortcut</h2>

          <label className="text-xs font-semibold text-gray-500 mb-1 block">
            &ldquo;Hey Siri, add to my TallyCrew calendar…&rdquo;
          </label>
          <textarea
            value={siriText}
            onChange={(e) => setSiriText(e.target.value)}
            rows={3}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 mb-3"
          />
          <button
            type="button"
            onClick={handleParseSiri}
            className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl py-3 text-sm transition-colors mb-5"
          >
            Parse with Siri
          </button>

          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Draft Jobs (Calendar)</p>
            {drafts.length === 0 && (
              <p className="text-xs text-gray-400 italic">Nothing yet — try parsing a phrase above.</p>
            )}
            {drafts.map((d) => (
              <div key={d.id} className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5">
                <p className="text-sm font-semibold text-gray-900">{d.title}</p>
                <p className="text-[11px] text-gray-500 mt-0.5">{d.when}</p>
                <p className="text-[10px] text-amber-700 font-medium mt-1">Unverified — review in Calendar</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-gray-50 border-t border-gray-200 py-16 text-center">
        <div className="max-w-xl mx-auto px-5">
          <h2 className="font-display text-2xl font-bold text-gray-900 mb-4">Like what you see?</h2>
          <p className="text-gray-500 mb-8">Set up your real company and crew in a couple minutes.</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <a href={REGISTER_URL} className="bg-navy-600 hover:bg-navy-700 text-white font-semibold rounded-xl px-6 py-3.5 transition-colors">
              Start Free Trial
            </a>
            <Link href="/site/features" className="bg-white border border-gray-200 hover:border-gray-300 text-gray-900 font-semibold rounded-xl px-6 py-3.5 transition-colors">
              See All Features
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
