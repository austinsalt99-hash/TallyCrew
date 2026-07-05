import { NextResponse } from "next/server";
import { createSupabaseServer, getSessionUser } from "@/lib/supabase-server";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

const BUCKET = "company-banners";

export async function POST(req: Request) {
  const supabase = await createSupabaseServer();
  const { profile } = await getSessionUser(supabase);
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (profile.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

  const admin = createSupabaseAdmin();

  // Create bucket if it doesn't exist
  const { error: bucketError } = await admin.storage.createBucket(BUCKET, {
    public: true,
    allowedMimeTypes: ["image/png", "image/jpeg", "image/webp", "image/gif"],
  });
  if (bucketError && !bucketError.message.toLowerCase().includes("already exist")) {
    return NextResponse.json({ error: `Bucket error: ${bucketError.message}` }, { status: 500 });
  }

  const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase();
  const path = `${profile.company_id}/banner.${ext}`;
  const bytes = await file.arrayBuffer();

  const { error: uploadError } = await admin.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: file.type, upsert: true });

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const { data } = admin.storage.from(BUCKET).getPublicUrl(path);

  // Save URL to companies table
  await admin.from("companies").update({ banner_url: data.publicUrl }).eq("id", profile.company_id);

  return NextResponse.json({ url: data.publicUrl });
}
