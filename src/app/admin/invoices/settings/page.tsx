"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

export default function InvoicingSettingsPage() {
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/company", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => { setLogoUrl(data.invoice_logo_url ?? null); setLoading(false); });
  }, []);

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setUploading(true);
    setError("");
    setSaved(false);
    try {
      const fd = new FormData();
      fd.append("file", file, file.name);
      const res = await fetch("/api/company/invoice-logo", { method: "POST", credentials: "include", body: fd });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Upload failed");
      setLogoUrl(json.url);
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function removeLogo() {
    setUploading(true);
    setError("");
    setSaved(false);
    try {
      const res = await fetch("/api/company/invoice-logo", { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Failed to remove logo");
      setLogoUrl(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove logo");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="max-w-lg">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin/invoices" className="text-gray-400 hover:text-gray-600 text-sm">← Invoices</Link>
      </div>
      <h1 className="text-2xl font-bold text-gray-900 mb-5">Invoicing Settings</h1>

      <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
        <div>
          <p className="text-sm font-semibold text-gray-900 mb-0.5">Invoice Logo</p>
          <p className="text-xs text-gray-400">Shown at the top of every invoice, in place of your company name.</p>
        </div>

        {loading ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : (
          <>
            <input
              ref={fileInputRef}
              id="invoice-logo-file-input"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              className="hidden"
              onChange={handleFileSelect}
            />

            <label
              htmlFor="invoice-logo-file-input"
              className="flex items-center justify-center cursor-pointer rounded-xl overflow-hidden border-2 border-dashed border-gray-300 hover:border-navy-400 hover:bg-navy-50 transition-colors"
              style={{ minHeight: 140 }}
            >
              {logoUrl ? (
                <div className="relative w-full flex items-center justify-center p-4" style={{ minHeight: 140 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={logoUrl} alt="Invoice logo" className="max-h-24 max-w-full object-contain" />
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                    <span className="text-white text-sm font-semibold">Click to replace</span>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center gap-2 py-10">
                  <div className="w-12 h-12 rounded-xl bg-navy-100 flex items-center justify-center">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0A1172" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                  </div>
                  <p className="text-sm font-semibold text-gray-700">Click to upload a logo</p>
                  <p className="text-xs text-gray-400">PNG, JPG, WebP or SVG</p>
                </div>
              )}
            </label>

            {uploading && <p className="text-xs text-gray-400 text-center">Uploading…</p>}

            {logoUrl && !uploading && (
              <button
                type="button"
                onClick={removeLogo}
                className="w-full text-sm text-red-500 hover:text-red-700 font-medium"
              >
                Remove logo
              </button>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
                <p className="text-xs text-red-600 font-medium">{error}</p>
              </div>
            )}

            {saved && !error && (
              <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-3 py-2.5">
                <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="7.5" cy="7.5" r="6.5" /><polyline points="4.5,7.5 6.5,9.5 10.5,5.5" />
                </svg>
                <p className="text-xs text-green-700 font-medium">Logo saved — it&apos;ll appear on new and existing invoices.</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
