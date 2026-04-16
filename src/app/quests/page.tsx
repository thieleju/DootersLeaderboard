import { redirect } from "next/navigation";

import { auth } from "~/server/auth";
import QuestsPageClient from "../_components/quests-page-client";

export default async function QuestsPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  if (session.user.role !== "moderator" && session.user.role !== "admin") {
    redirect("/");
  }

  return <QuestsPageClient />;
}
