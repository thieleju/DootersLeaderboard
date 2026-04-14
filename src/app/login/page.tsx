import LoginCard from "../_components/login-card";
import { redirect } from "next/navigation";

import { auth } from "~/server/auth";

export default async function LoginPage() {
  const session = await auth();

  if (session?.user) {
    redirect("/");
  }

  return (
    <div className="flex h-[calc(100vh-12rem)] items-center justify-center">
      <LoginCard />
    </div>
  );
}
