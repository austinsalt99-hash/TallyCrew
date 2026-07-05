import { redirect } from "next/navigation";

// The old password-based admin login is replaced by /login.
// Middleware will redirect unauthenticated users to /login anyway.
export default function AdminIndex() {
  redirect("/admin/home");
}
