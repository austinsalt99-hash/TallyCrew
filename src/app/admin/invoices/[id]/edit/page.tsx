"use client";

import { useParams } from "next/navigation";
import InvoiceForm from "../../_components/InvoiceForm";

export default function EditInvoicePage() {
  const { id } = useParams<{ id: string }>();
  return <InvoiceForm mode="edit" invoiceId={id} />;
}
