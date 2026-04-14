import Link from "next/link";

export default function Footer() {
  return (
    <footer className="fixed bottom-0 left-0 right-0 z-40 bg-gray-800/80 backdrop-blur-sm border-t border-black">
      <div className="container-max h-16 flex items-center justify-between">
        <div className="text-sm text-gray-400">
          {/* &copy; 2024 All rights reserved. */}
        </div>

        <div className="flex items-center gap-6">
          <Link
            href="/privacy"
            className="text-sm text-gray-400 hover:text-amber-300 transition-colors"
          >
            Privacy
          </Link>
          <Link
            href="/terms"
            className="text-sm text-gray-400 hover:text-amber-300 transition-colors"
          >
            Terms
          </Link>
          <a
            href="https://github.com/thieleju/DootersLeaderboard"
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-gray-400 hover:text-amber-300 transition-colors"
          >
            GitHub
          </a>
        </div>
      </div>
    </footer>
  );
}
