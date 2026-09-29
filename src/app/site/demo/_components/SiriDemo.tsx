"use client";

import { useEffect, useRef, useState } from "react";
import { REGISTER_URL } from "../../_lib/constants";

// Real voice input (Web Speech API) feeding the same Claude parser the app
// uses (parseVoiceEventText, via /api/demo/parse-voice) — this is the
// unauthenticated marketing-site version of the admin Calendar page's
// "Voice" button (src/app/admin/calendar/page.tsx: handleVoiceToggle).
// Nothing here writes to a real calendar; it just shows what the AI made of
// what you said. Capped client-side at MAX_USES/day for a snappy "tries
// left" readout — the real cap lives server-side in the API route, since
// this counter is easily cleared and isn't the actual enforcement.
const MAX_USES = 5;
const USES_STORAGE_KEY = "tc-demo-voice-uses";

interface DraftJob {
  id: string;
  title: string;
  when: string;
  client: string;
  location: string;
  assignedTo: string;
  notes: string;
}

let draftCounter = 0;
function uid(): string {
  draftCounter += 1;
  return `draft-${draftCounter}`;
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function readStoredUses(): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = window.localStorage.getItem(USES_STORAGE_KEY);
    if (!raw) return 0;
    const parsed = JSON.parse(raw) as { day: string; count: number };
    return parsed.day === todayKey() ? parsed.count : 0;
  } catch {
    return 0;
  }
}

function recordUse(): number {
  const next = readStoredUses() + 1;
  try {
    window.localStorage.setItem(USES_STORAGE_KEY, JSON.stringify({ day: todayKey(), count: next }));
  } catch {
    // localStorage unavailable (private browsing, etc.) — the server-side
    // cap in /api/demo/parse-voice still applies regardless.
  }
  return next;
}

function formatWhen(date?: string, start?: string, end?: string): string {
  let when = "";
  if (date) {
    const parsed = new Date(`${date}T00:00:00`);
    when = Number.isNaN(parsed.getTime())
      ? date
      : parsed.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  }
  const time = [start, end].filter(Boolean).join(" – ");
  if (time) when = when ? `${when} · ${time}` : time;
  return when || "Today";
}

export default function SiriDemo() {
  const [siriText, setSiriText] = useState("pour the foundation at the Miller site tomorrow morning");
  const [drafts, setDrafts] = useState<DraftJob[]>([]);
  const [listening, setListening] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // These read browser-only state (localStorage, SpeechRecognition) that
  // doesn't exist during SSR, so the initial value here has to match what
  // the server rendered (5 tries, no mic button) — a lazy useState
  // initializer would run again during the client's hydration pass and
  // disagree with the server HTML. Corrected in the effect below, same
  // pattern as src/lib/useOnlineStatus.ts.
  const [usesLeft, setUsesLeft] = useState(MAX_USES);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    setUsesLeft(Math.max(0, MAX_USES - readStoredUses()));
    setVoiceSupported(!!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition));
  }, []);

  async function handleParse(text: string) {
    const trimmed = text.trim();
    if (!trimmed || parsing) return;
    if (usesLeft <= 0) {
      setError(`You've used all ${MAX_USES} free tries for this demo — start a free trial to keep going in the real app.`);
      return;
    }

    setParsing(true);
    setError(null);
    // Counts the attempt right away — it consumes one of the server's 5
    // tries whether the parse succeeds or not.
    setUsesLeft(Math.max(0, MAX_USES - recordUse()));

    try {
      const res = await fetch("/api/demo/parse-voice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to parse that.");
      setDrafts((prev) => [
        {
          id: uid(),
          title: data.title?.trim() || "New job",
          when: formatWhen(data.date, data.start_time, data.end_time),
          client: data.client?.trim() ?? "",
          location: data.location?.trim() ?? "",
          assignedTo: data.assigned_to?.trim() ?? "",
          notes: data.description?.trim() ?? "",
        },
        ...prev,
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setParsing(false);
    }
  }

  function handleVoiceToggle() {
    if (listening) {
      recognitionRef.current?.stop();
      return;
    }

    const SpeechRecognitionClass = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognitionClass) {
      setError("Voice input isn't supported in this browser — try Chrome or Safari, or just type it below.");
      return;
    }
    if (usesLeft <= 0) {
      setError(`You've used all ${MAX_USES} free tries for this demo — start a free trial to keep going in the real app.`);
      return;
    }

    const recognition = new SpeechRecognitionClass();
    recognition.lang = "en-US";
    recognition.interimResults = true;
    recognition.continuous = false;
    recognitionRef.current = recognition;

    let finalTranscript = "";
    setError(null);
    setSiriText("");
    setListening(true);

    recognition.onresult = (event: any) => {
      finalTranscript = Array.from(event.results as any[]).map((r: any) => r[0].transcript).join("");
      setSiriText(finalTranscript);
    };

    recognition.onend = () => {
      setListening(false);
      if (finalTranscript.trim()) handleParse(finalTranscript);
    };

    recognition.onerror = (event: any) => {
      setListening(false);
      const err = event.error;
      if (err === "not-allowed") {
        setError("Microphone access was denied — allow it in your browser's address bar and try again.");
      } else if (err === "no-speech") {
        setError("Didn't catch any speech — try again and speak clearly.");
      } else if (err === "audio-capture") {
        setError("No microphone found.");
      } else {
        setError(`Voice error: ${err}`);
      }
    };

    try {
      recognition.start();
    } catch (e) {
      setListening(false);
      setError(`Could not start voice input: ${e}`);
    }
  }

  const exhausted = usesLeft <= 0;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
      <p className="text-xs font-semibold text-orange-500 uppercase tracking-wide mb-1">Siri Shortcuts</p>
      <h2 className="font-display text-xl font-bold text-gray-900 mb-2">Try it with your real voice</h2>
      <p className="text-sm text-gray-500 mb-4">
        This runs the exact same Claude model that parses the real Siri Shortcut and the Calendar page&apos;s
        Voice button — just capped to {MAX_USES} tries here so the demo doesn&apos;t rack up API costs.
      </p>

      {exhausted ? (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center mb-5">
          <p className="text-sm text-amber-800 font-medium mb-3">
            You&apos;ve used all {MAX_USES} free tries for this demo.
          </p>
          <a
            href={REGISTER_URL}
            className="inline-block bg-navy-600 hover:bg-navy-700 text-white font-semibold rounded-xl px-5 py-2.5 text-sm transition-colors"
          >
            Start Free Trial
          </a>
        </div>
      ) : (
        <>
          <label className="text-xs font-semibold text-gray-500 mb-1 block">
            &ldquo;Add to my TallyCrew calendar…&rdquo;
          </label>
          <textarea
            value={siriText}
            onChange={(e) => setSiriText(e.target.value)}
            rows={3}
            disabled={listening}
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 mb-3 disabled:bg-gray-50 disabled:text-gray-400"
          />

          {error && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">{error}</p>
          )}

          <div className="flex flex-wrap gap-2 mb-1.5">
            {voiceSupported && (
              <button
                type="button"
                onClick={handleVoiceToggle}
                disabled={parsing}
                className={`flex-1 min-w-[140px] font-semibold rounded-xl py-3 text-sm transition-colors disabled:opacity-50 ${
                  listening ? "bg-red-500 hover:bg-red-600 text-white" : "bg-orange-500 hover:bg-orange-600 text-white"
                }`}
              >
                {listening ? "⏹ Stop listening" : "🎤 Speak it"}
              </button>
            )}
            <button
              type="button"
              onClick={() => handleParse(siriText)}
              disabled={parsing || listening}
              className="flex-1 min-w-[140px] bg-white border border-gray-200 hover:border-gray-300 text-gray-900 font-semibold rounded-xl py-3 text-sm transition-colors disabled:opacity-50"
            >
              {parsing ? "Parsing…" : "Parse typed text"}
            </button>
          </div>
          <p className="text-[11px] text-gray-400 mb-5">{usesLeft} of {MAX_USES} free tries left today</p>
        </>
      )}

      <div className="space-y-2">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Draft Jobs (Calendar)</p>
        {drafts.length === 0 && (
          <p className="text-xs text-gray-400 italic">Nothing yet — try speaking or parsing a phrase above.</p>
        )}
        {drafts.map((d) => (
          <div key={d.id} className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 space-y-1">
            <div>
              <p className="text-sm font-semibold text-gray-900">{d.title}</p>
              <p className="text-[11px] text-gray-500 mt-0.5">{d.when}</p>
            </div>
            {(d.client || d.location) && (
              <p className="text-[11px] text-gray-600">{[d.client, d.location].filter(Boolean).join(" · ")}</p>
            )}
            {d.assignedTo && (
              <p className="text-[11px] text-gray-600">
                <span className="text-gray-400">Assigned to:</span> {d.assignedTo}
              </p>
            )}
            {d.notes && (
              <p className="text-[11px] text-gray-600 italic">
                <span className="text-gray-400 not-italic">Notes:</span> {d.notes}
              </p>
            )}
            <p className="text-[10px] text-amber-700 font-medium pt-0.5">Unverified — review in Calendar</p>
          </div>
        ))}
      </div>
    </div>
  );
}
