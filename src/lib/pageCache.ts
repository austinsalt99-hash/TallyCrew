"use client";

import { createStore, get, set, del } from "idb-keyval";
import { createSupabaseBrowser } from "@/lib/supabase-browser";

// Keeps the last response for the main tabs' data requests, so a tab you come back to
// shows what it showed before straight away and then quietly refreshes. Held in memory
// and saved to the device (IndexedDB) so it also survives an app restart.
//
// Tied to the signed-in user: if a different account is signed in on this device, the
// cache starts empty. Any request that changes data (anything but a GET to /api/)
// clears it, so a tab never shows data from before your own changes.

type Entry = { data: unknown; at: number };
type Saved = { userId: string; entries: [string, Entry][] };

const MAX_ENTRIES = 80;
const MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000;
const SAVED_KEY = "entries";

const memory = new Map<string, Entry>();
let ownerId: string | null = null;
let restored: Promise<void> | null = null;
let saveTimer: ReturnType<typeof setTimeout> | null = null;
// Bumped whenever the cache is cleared, so a request that started before the clear
// can't put its now-outdated response back in.
let generation = 0;

let idbStore: ReturnType<typeof createStore> | null = null;
function store() {
  if (!idbStore && typeof indexedDB !== "undefined") idbStore = createStore("tallycrew-page-cache", "cache");
  return idbStore;
}

async function currentUserId(): Promise<string | null> {
  try {
    const { data } = await createSupabaseBrowser().auth.getSession();
    return data.session?.user.id ?? null;
  } catch {
    return null;
  }
}

function restore(): Promise<void> {
  restored ??= (async () => {
    const s = store();
    if (!s) return;
    const saved = await get<Saved>(SAVED_KEY, s);
    if (!saved || saved.userId !== ownerId) return;
    const cutoff = Date.now() - MAX_AGE_MS;
    for (const [url, entry] of saved.entries) {
      if (entry.at > cutoff && !memory.has(url)) memory.set(url, entry);
    }
  })().catch(() => {});
  return restored;
}

// Works out whose cache this is (emptying it if the account changed) and loads the saved
// copy from the device. Returns false when nobody is signed in, and nothing is cached then.
async function ready(): Promise<boolean> {
  const id = await currentUserId();
  if (id !== ownerId) {
    memory.clear();
    generation++;
    ownerId = id;
    restored = null;
  }
  if (!id) return false;
  await restore();
  return true;
}

function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const s = store();
    if (!s || !ownerId) return;
    const saved: Saved = { userId: ownerId, entries: [...memory] };
    set(SAVED_KEY, saved, s).catch(() => {});
  }, 1000);
}

function remember(url: string, data: unknown) {
  memory.delete(url); // re-inserting keeps the Map in least-recently-used order
  memory.set(url, { data, at: Date.now() });
  while (memory.size > MAX_ENTRIES) memory.delete(memory.keys().next().value!);
  scheduleSave();
}

async function fetchFresh(url: string): Promise<unknown> {
  const gen = generation;
  const res = await fetch(url, { credentials: "include" });
  const data = await res.json();
  if (res.ok && ownerId && gen === generation) remember(url, data);
  return data;
}

// Calls `apply` with the saved responses for `urls` straight away (only when every one of
// them is saved), then again with fresh responses once they arrive. Results come in the
// same order as `urls`. `onDone` runs after the fresh request, whether it worked or not.
// Returns a cancel function for an effect's cleanup, so a slow response for an old view
// never overwrites a newer one.
export function loadCached<T extends unknown[]>(
  urls: string[],
  apply: (results: T) => void,
  onDone?: () => void
): () => void {
  let cancelled = false;
  (async () => {
    try {
      if (await ready()) {
        const cached = urls.map((u) => memory.get(u));
        if (!cancelled && cached.every((e) => e)) apply(cached.map((e) => e!.data) as T);
      }
      const fresh = await Promise.all(urls.map(fetchFresh));
      if (!cancelled) apply(fresh as T);
    } catch {
      // Network or parse failure: leave whatever is on screen, same as before caching.
    } finally {
      if (!cancelled) onDone?.();
    }
  })();
  return () => {
    cancelled = true;
  };
}

// Fetches `urls` into the cache in the background, so even the first visit to a tab is instant.
export async function warmCache(urls: string[]): Promise<void> {
  if (!navigator.onLine || !(await ready())) return;
  await Promise.all(urls.map((u) => fetchFresh(u).catch(() => null)));
}

export function clearPageCache() {
  memory.clear();
  generation++;
  if (saveTimer) clearTimeout(saveTimer);
  const s = store();
  if (s) del(SAVED_KEY, s).catch(() => {});
}

let watching = false;

// Clears the cache after any request that changes data: every method except GET/HEAD
// to this app's /api/ routes. Installed once from the root layout.
export function watchForDataChanges() {
  if (watching || typeof window === "undefined") return;
  watching = true;
  const original = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const res = await original(input, init);
    try {
      const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
      if (method !== "GET" && method !== "HEAD") {
        const raw = input instanceof Request ? input.url : String(input);
        const url = new URL(raw, window.location.href);
        if (url.origin === window.location.origin && url.pathname.startsWith("/api/")) clearPageCache();
      }
    } catch {
      // An unparseable URL isn't one of ours.
    }
    return res;
  };
}
