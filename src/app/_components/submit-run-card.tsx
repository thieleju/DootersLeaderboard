import Link from "next/link";

import { auth } from "~/server/auth";

import AnimatedCard from "./animated-card";

interface HomeCtaCardProps {
  delay?: number;
}

export default async function HomeCtaCard({ delay = 0 }: HomeCtaCardProps) {
  const session = await auth();
  const isLoggedIn = Boolean(session?.user);

  const description = isLoggedIn
    ? "Click the button below to submit your run."
    : "To submit a run, log in with your discord account.";

  const primaryHref = isLoggedIn
    ? `/profile/${session?.user.id}#submit-run-form`
    : "/login";
  const primaryLabel = isLoggedIn ? "Submit a run" : "Login";

  return (
    <AnimatedCard delay={delay} className="p-8 text-center">
      <div className="mb-8 text-gray-300">{description}</div>
      <div className="flex flex-wrap justify-center gap-4">
        <Link
          href={primaryHref}
          className="rounded bg-amber-400 px-6 py-2 font-semibold text-gray-900 transition-colors hover:bg-amber-300"
        >
          {primaryLabel}
        </Link>
        <Link
          href="/rankings"
          className="rounded border border-gray-600 px-6 py-2 font-semibold text-gray-300 transition-colors hover:border-amber-400 hover:text-amber-400"
        >
          View Rankings
        </Link>
      </div>
    </AnimatedCard>
  );
}
