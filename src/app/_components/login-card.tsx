"use client";

import { signIn } from "next-auth/react";
import { UserRound } from "lucide-react";

import AnimatedCard from "./animated-card";

export default function LoginCard() {
  return (
    <AnimatedCard className="w-full max-w-md p-6 text-center shadow-2xl shadow-black/20">
      <div className="mb-4 flex justify-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-amber-400/30 bg-amber-400/10 text-amber-300">
          <UserRound className="h-6 w-6" />
        </div>
      </div>

      <h2 className="text-2xl font-bold text-white">Login</h2>
      <p className="mt-2 text-sm text-gray-400">Use your Discord account.</p>

      <button
        onClick={() => signIn("discord", { callbackUrl: "/" })}
        className="mt-6 flex w-full cursor-pointer items-center justify-center gap-3 rounded bg-amber-400 px-6 py-2 font-semibold text-gray-900 transition-colors hover:bg-amber-300"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="h-5 w-5 fill-current"
        >
          <path d="M20.317 4.3698a19.791 19.791 0 0 0-4.8851-1.5152 14.479 14.479 0 0 0-.705-1.0652 19.736 19.736 0 0 0-6.2483 0c-.2576.3267-.4939.6815-.705 1.0652a19.791 19.791 0 0 0-4.8852 1.5152C1.917 9.1469.6428 13.7954 1.1795 18.3781a19.9 19.9 0 0 0 5.9955 3.0294c.4886-.6695.9253-1.3806 1.302-2.1231-.7188-.2714-1.4028-.6045-2.0474-.9922.171-.1273.3399-.2616.5021-.4026 3.9436 1.8358 8.2139 1.8358 12.1149 0 .1622.141.331.2753.5021.4026-.6447.3877-1.3287.7208-2.0475.9922.3767.7425.8134 1.4536 1.302 2.1231a19.876 19.876 0 0 0 5.9955-3.0294c.635-5.1503-1.0914-9.7579-4.7275-13.2524ZM8.02 15.3312c-1.1835 0-2.1577-1.0857-2.1577-2.419 0-1.3332.946-2.424 2.1577-2.424 1.2187 0 2.19 1.0908 2.1578 2.424 0 1.3333-.946 2.419-2.1578 2.419Zm7.9801 0c-1.1835 0-2.1577-1.0857-2.1577-2.419 0-1.3332.946-2.424 2.1577-2.424 1.2187 0 2.19 1.0908 2.1578 2.424 0 1.3333-.938 2.419-2.1578 2.419Z" />
        </svg>
        Login with Discord
      </button>

      {/* <Link
        href="/"
        className="mt-6 inline-flex items-center justify-center gap-2 rounded-lg bg-amber-400 px-5 py-3 font-semibold text-gray-900 transition-colors hover:bg-amber-300"
      >
        <LogIn className="h-4 w-4" />
        Go back
      </Link> */}
    </AnimatedCard>
  );
}
