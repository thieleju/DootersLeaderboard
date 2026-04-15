import Link from "next/link";
import { ShieldCheck, Trophy } from "lucide-react";
import { auth } from "~/server/auth";
import LoginButton from "./login-button";

export default async function Header() {
  const session = await auth();
  const isAdmin = session?.user?.role === "admin";

  return (
    <header className="sticky top-0 z-50 border-b border-black bg-gray-800/80 backdrop-blur-sm">
      <nav className="container-max flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-auto text-lg font-bold text-amber-300">
            Dooters Leaderboard
          </div>
        </Link>

        <div className="flex items-center gap-1">
          {isAdmin ? (
            <Link
              href="/admin"
              className="mr-5 flex items-center gap-2 text-gray-300 transition-colors hover:text-amber-300"
            >
              <ShieldCheck className="h-4 w-4" />
              <span>Admin</span>
            </Link>
          ) : null}

          <Link
            href="/rankings"
            className="flex items-center gap-2 text-gray-300 transition-colors hover:text-amber-300"
          >
            <Trophy className="h-4 w-4" />
            <span>Rankings</span>
          </Link>

          {/* <Link
            href="/info"
            className="flex items-center gap-2 text-gray-300 transition-colors hover:text-amber-300"
          >
            <CircleHelp className="h-4 w-4" />
            <span className="hidden min-[400px]:inline">Info</span>
          </Link> */}

          <div className="ml-4 hidden items-center gap-2 border-l border-gray-600 pl-4 md:flex">
            <LoginButton />
          </div>
        </div>
      </nav>
    </header>
  );
}
