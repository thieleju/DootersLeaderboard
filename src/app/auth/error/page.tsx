import Link from "next/link";
import { AlertTriangle, ArrowLeft, LogIn } from "lucide-react";

import AnimatedCard from "~/app/_components/animated-card";

const errorMessages: Record<string, string> = {
  Configuration: "There is a problem with the server configuration.",
  AccessDenied: "You do not have access to sign in.",
  Verification: "The sign-in link is invalid or has expired.",
  Default: "Something went wrong while signing you in.",
};

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const errorKey = resolvedSearchParams.error ?? "Default";
  const message = errorMessages[errorKey] ?? errorMessages.Default;

  return (
    <div className="flex h-[calc(100vh-12rem)] items-center justify-center">
      <AnimatedCard className="w-full max-w-md p-6 text-center shadow-2xl shadow-black/20">
        <div className="mb-4 flex justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full border border-red-500/30 bg-red-500/10 text-red-300">
            <AlertTriangle className="h-6 w-6" />
          </div>
        </div>

        <h1 className="text-2xl font-bold text-white">Something went wrong</h1>
        <p className="mt-2 text-sm text-gray-400">{message}</p>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/login"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-amber-400 px-5 py-3 font-semibold text-gray-900 transition-colors hover:bg-amber-300"
          >
            <LogIn className="h-4 w-4" />
            Back to login
          </Link>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-700 px-5 py-3 font-semibold text-gray-300 transition-colors hover:border-amber-400 hover:text-amber-400"
          >
            <ArrowLeft className="h-4 w-4" />
            Home
          </Link>
        </div>
      </AnimatedCard>
    </div>
  );
}
