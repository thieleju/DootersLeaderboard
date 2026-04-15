"use client";

import Link from "next/link";
import Image from "next/image";
import { LogOut, UserRound } from "lucide-react";
import { signOut, useSession } from "next-auth/react";

export default function LoginButton() {
  const { data: session } = useSession();

  if (session?.user) {
    return (
      <div className="flex items-center gap-3">
        <Link
          href={`/profile/${session.user.id}`}
          className="flex items-center gap-2 text-gray-300 transition-colors hover:text-amber-300"
        >
          <span className="relative flex h-8 w-8 items-center justify-center overflow-hidden rounded-full border border-gray-600 bg-white/5">
            {session.user.image ? (
              <Image
                src={session.user.image}
                alt={
                  session.user.displayName ??
                  session.user.name ??
                  "Profile picture"
                }
                width={32}
                height={32}
                className="h-full w-full object-cover"
              />
            ) : (
              <UserRound className="h-4 w-4" />
            )}
          </span>
          <span className="hidden text-sm font-bold sm:inline">
            {session.user.displayName ?? session.user.username ?? "Profile"}
          </span>
        </Link>

        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/" })}
          className="inline-flex cursor-pointer items-center justify-center text-gray-300 transition-colors hover:text-amber-300"
          aria-label="Logout"
          title="Logout"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <Link
      href="/login"
      className="flex items-center gap-2 text-gray-300 transition-colors hover:text-amber-300"
    >
      <UserRound className="h-4 w-4" />
      <span>Login</span>
    </Link>
  );
}
