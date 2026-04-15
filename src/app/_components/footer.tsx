import Link from "next/link";

export default function Footer() {
  return (
    <footer className="fixed right-0 bottom-0 left-0 z-40 border-t border-black bg-gray-800/80 backdrop-blur-sm">
      <div className="container-max flex h-16 items-center justify-between">
        <div className="text-sm text-gray-400">
          {/* &copy; 2024 All rights reserved. */}
        </div>

        <div className="flex items-center gap-6">
          <Link
            href="/privacy"
            className="text-sm text-gray-400 transition-colors hover:text-amber-300"
          >
            Privacy
          </Link>
          <Link
            href="/terms"
            className="text-sm text-gray-400 transition-colors hover:text-amber-300"
          >
            Terms
          </Link>
          <a
            href="https://github.com/thieleju/DootersLeaderboard"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-gray-400 transition-colors hover:text-amber-300"
          >
            GitHub
          </a>
        </div>
      </div>
    </footer>
  );
}
