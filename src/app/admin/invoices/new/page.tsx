"use client";

import { use } from "react";
import InvoiceForm from "../_components/InvoiceForm";

// ?fromQuote=<id> copies a quote; ?fromJob=<id> starts from a calendar job.
export default function NewInvoicePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = use(searchParams);
  const fromQuote = typeof params.fromQuote === "string" ? params.fromQuote : undefined;
  const fromJob = typeof params.fromJob === "string" ? params.fromJob : undefined;
  return <InvoiceForm mode="new" fromQuoteId={fromQuote} fromJobId={fromJob} />;
}
