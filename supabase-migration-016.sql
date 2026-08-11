-- Migration 016: Invoice logo support
--
-- Lets a company upload its own logo to appear on invoices (PDF/print view),
-- instead of TallyCrew's own branding. Mirrors the company-banners setup.

ALTER TABLE companies ADD COLUMN IF NOT EXISTS invoice_logo_url TEXT;

INSERT INTO storage.buckets (id, name, public)
VALUES ('invoice-logos', 'invoice-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Paths are `${company_id}/logo.ext` — insert/delete are scoped to admins
-- writing within their own company's folder, matching company_banners.
CREATE POLICY "invoice_logos_read" ON storage.objects FOR SELECT USING (bucket_id = 'invoice-logos');

CREATE POLICY "invoice_logos_insert" ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'invoice-logos'
    AND get_my_role() = 'admin'
    AND (storage.foldername(name))[1] = get_my_company_id()::text
  );

CREATE POLICY "invoice_logos_delete" ON storage.objects FOR DELETE
  USING (
    bucket_id = 'invoice-logos'
    AND get_my_role() = 'admin'
    AND (storage.foldername(name))[1] = get_my_company_id()::text
  );
