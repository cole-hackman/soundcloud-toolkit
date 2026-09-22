"use client";

import { AdminConsole } from "@/components/admin/AdminConsole";

// The console lives in src/components/admin/. This page only mounts it; the
// access gate (signed in + on ADMIN_IDS) is inside AdminConsole so that no
// admin request is issued before the session is confirmed.
export default function AdminPage() {
  return <AdminConsole />;
}
