import { NextResponse } from "next/server";
import { createToken } from "@/lib/auth";

export async function POST(request: Request) {
  const { password } = await request.json();
  if (password === process.env.ADMIN_PASSWORD) {
    return NextResponse.json({ token: createToken() });
  }
  return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
}
