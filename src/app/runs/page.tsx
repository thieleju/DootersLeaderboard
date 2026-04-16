import { redirect } from "next/navigation";

import { auth } from "~/server/auth";
import RunsPageClient from "../_components/runs-page-client";

export default async function RunsPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.role !== "moderator" && session.user.role !== "admin") {
    redirect("/");
  }

  return <RunsPageClient />;
}
