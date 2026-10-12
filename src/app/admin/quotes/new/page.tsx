"use client";

import { use } from "react";
import InvoiceForm from "../../invoices/_components/InvoiceForm";

// ?fromJob=<id> starts the quote from a calendar job.
export default function NewQuotePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = use(searchParams);
  const fromJob = typeof params.fromJob === "string" ? params.fromJob : undefined;
  return <InvoiceForm kind="quote" mode="new" fromJobId={fromJob} />;
}
