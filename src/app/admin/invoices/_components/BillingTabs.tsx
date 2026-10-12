import Link from "next/link";

// Switch between the Quotes and Invoices lists.
export default function BillingTabs({ active }: { active: "quotes" | "invoices" }) {
  const tab = (key: "quotes" | "invoices", label: string, href: string) => (
    <Link
      href={href}
      style={active === key ? { backgroundColor: "#0A1172" } : undefined}
      className={`flex-1 text-center px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
        active === key ? "text-white" : "text-gray-500 hover:text-gray-900"
      }`}
    >
      {label}
    </Link>
  );
  return (
    <div className="flex gap-1 mb-5 bg-white rounded-xl border border-gray-200 p-1 w-full sm:w-72">
      {tab("quotes", "Quotes", "/admin/quotes")}
      {tab("invoices", "Invoices", "/admin/invoices")}
    </div>
  );
}
