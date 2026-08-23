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
  // The storage path is always the same for a given company (banner.<ext>), so
  // the public URL never changes across re-uploads. Since Supabase Storage
  // serves it with a 1-hour cache-control, browsers keep showing the old
  // cached image at that URL unless we bust the cache in the stored URL itself.
  const cacheBustedUrl = `${data.publicUrl}?v=${Date.now()}`;

  // Save URL to companies table
  const { data: updatedRows, error: updateError } = await admin
    .from("companies")
    .update({ banner_url: cacheBustedUrl })
    .eq("id", profile.company_id)
    .select("id, banner_url");

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
  if (!updatedRows || updatedRows.length === 0) {
    return NextResponse.json(
      { error: `No company row matched id=${profile.company_id} — banner not saved.` },
      { status: 500 }
    );
  }

  return NextResponse.json({ url: cacheBustedUrl });
}
