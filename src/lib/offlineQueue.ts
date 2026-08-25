import { createStore, get, set, del, keys } from "idb-keyval";

const store = createStore("tallycrew-offline", "submissions");

export interface QueuedSubmission {
  id: string;
  method: "POST" | "PUT";
  payload: Record<string, unknown>;
  queuedAt: number;
  lastError?: { status: number; message: string };
}

export async function enqueueSubmission(
  method: "POST" | "PUT",
  payload: Record<string, unknown>
): Promise<QueuedSubmission> {
  const entry: QueuedSubmission = { id: crypto.randomUUID(), method, payload, queuedAt: Date.now() };
  await set(entry.id, entry, store);
  return entry;
}

export async function listQueuedSubmissions(): Promise<QueuedSubmission[]> {
  const ks = await keys<string>(store);
  const entries = await Promise.all(ks.map((k) => get<QueuedSubmission>(k, store)));
  return entries.filter((e): e is QueuedSubmission => !!e).sort((a, b) => a.queuedAt - b.queuedAt);
}

export async function removeQueuedSubmission(id: string): Promise<void> {
  await del(id, store);
}

export async function markQueuedSubmissionError(id: string, status: number, message: string): Promise<void> {
  const existing = await get<QueuedSubmission>(id, store);
  if (existing) await set(id, { ...existing, lastError: { status, message } }, store);
}
