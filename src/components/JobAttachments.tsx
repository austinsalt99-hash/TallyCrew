"use client";

import { useRef, useState } from "react";
import { createSupabaseBrowser } from "@/lib/supabase-browser";

export interface JobAttachment {
  url: string;
  name: string;
  uploadedAt: string;
}

export default function JobAttachments({
  jobId, attachments, onChange, canManage,
}: {
  jobId: string;
  attachments: JobAttachment[];
  onChange?: (next: JobAttachment[]) => void;
  canManage: boolean;
}) {
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length || !onChange) return;
    setUploading(true);
    try {
      const added: JobAttachment[] = [];
      for (const file of files) {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `${jobId}/${Date.now()}-${safeName}`;
        const { error } = await createSupabaseBrowser().storage.from("job-photos").upload(path, file);
        if (error) throw error;
        const { data } = createSupabaseBrowser().storage.from("job-photos").getPublicUrl(path);
        added.push({ url: data.publicUrl, name: file.name, uploadedAt: new Date().toISOString() });
      }
      onChange([...attachments, ...added]);
    } catch (err) {
      console.error("Attachment upload failed:", err);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeAttachment = (url: string) => {
    if (!onChange) return;
    onChange(attachments.filter((a) => a.url !== url));
  };

  return (
    <div className="space-y-2">
      {attachments.length === 0 && <p className="text-xs text-gray-400">No attachments yet.</p>}
      {attachments.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {attachments.map((a) => (
            <div key={a.url} className="relative group">
              <a href={a.url} target="_blank" rel="noopener noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={a.url} alt={a.name} className="w-full h-20 object-cover rounded-lg border border-gray-200" />
              </a>
              {canManage && (
                <button
                  type="button"
                  onClick={() => removeAttachment(a.url)}
                  className="absolute top-1 right-1 w-5 h-5 flex items-center justify-center rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                  aria-label="Remove attachment"
                >
                  <svg width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="1" y1="1" x2="11" y2="11"/><line x1="11" y1="1" x2="1" y2="11"/></svg>
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      {canManage && (
        <div>
          <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleFileChange} className="hidden" id={`attach-upload-${jobId}`} />
          <label
            htmlFor={`attach-upload-${jobId}`}
            className="inline-block text-xs font-semibold text-navy-600 border border-navy-200 rounded-lg px-3 py-1.5 cursor-pointer hover:bg-navy-50"
          >
            {uploading ? "Uploading…" : "+ Add photo"}
          </label>
        </div>
      )}
    </div>
  );
}
