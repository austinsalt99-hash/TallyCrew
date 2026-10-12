"use client";

import { useParams } from "next/navigation";
import InvoiceForm from "../../../invoices/_components/InvoiceForm";

export default function EditQuotePage() {
  const { id } = useParams<{ id: string }>();
  return <InvoiceForm kind="quote" mode="edit" invoiceId={id} />;
}
