import { NextResponse } from "next/server";
import { createSupabaseServer, getSessionUser } from "@/lib/supabase-server";
import { createSupabaseAdmin } from "@/lib/supabase-admin";

const BUCKET = "invoice-logos";

export async function POST(req: Request) {
  const supabase = await createSupabaseServer();
  const { profile } = await getSessionUser(supabase);
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (profile.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });

  const admin = createSupabaseAdmin();

  const { error: bucketError } = await admin.storage.createBucket(BUCKET, {
    public: true,
    allowedMimeTypes: ["image/png", "image/jpeg", "image/webp", "image/svg+xml"],
  });
  if (bucketError && !bucketError.message.toLowerCase().includes("already exist")) {
    return NextResponse.json({ error: `Bucket error: ${bucketError.message}` }, { status: 500 });
  }

  const ext = (file.name.split(".").pop() ?? "png").toLowerCase();
  const path = `${profile.company_id}/logo.${ext}`;
  const bytes = await file.arrayBuffer();

  const { error: uploadError } = await admin.storage
    .from(BUCKET)
    .upload(path, bytes, { contentType: file.type, upsert: true });

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 });

  const { data } = admin.storage.from(BUCKET).getPublicUrl(path);
  // Same path is reused on every re-upload, so the public URL never changes —
  // bust the cache in the stored URL itself so browsers pick up the new file.
  const cacheBustedUrl = `${data.publicUrl}?v=${Date.now()}`;

  const { data: updatedRows, error: updateError } = await admin
    .from("companies")
    .update({ invoice_logo_url: cacheBustedUrl })
    .eq("id", profile.company_id)
    .select("id, invoice_logo_url");

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
  if (!updatedRows || updatedRows.length === 0) {
    return NextResponse.json(
      { error: `No company row matched id=${profile.company_id} — logo not saved.` },
      { status: 500 }
    );
  }

  return NextResponse.json({ url: cacheBustedUrl });
}

export async function DELETE() {
  const supabase = await createSupabaseServer();
  const { profile } = await getSessionUser(supabase);
  if (!profile) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (profile.role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { error } = await supabase
    .from("companies")
    .update({ invoice_logo_url: null })
    .eq("id", profile.company_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
