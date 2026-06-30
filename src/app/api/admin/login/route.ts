import { NextResponse } from "next/server";

// This endpoint is from the old homegrown-JWT admin auth system.
// Auth is now handled entirely by Supabase. This route is disabled.
export async function POST() {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}
