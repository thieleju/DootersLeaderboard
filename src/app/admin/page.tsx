import { redirect } from "next/navigation";

import { auth } from "~/server/auth";
import AdminPageClient from "../_components/admin-page-client";

export default async function AdminPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.role !== "admin") {
    redirect("/");
  }

  return <AdminPageClient />;
}
