import Link from "next/link";
import { FileWarning, Home } from "lucide-react";

import AnimatedCard from "./_components/animated-card";

export default function NotFound() {
  return (
    <div className="flex h-[calc(100vh-12rem)] items-center justify-center">
      <AnimatedCard className="w-full max-w-md p-6 text-center shadow-2xl shadow-black/20">
        <div className="mb-4 flex justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full border border-red-500/30 bg-red-500/10 text-red-300">
            <FileWarning className="h-6 w-6" />
          </div>
        </div>

        <h1 className="text-2xl font-bold text-white">Page not found</h1>
        <p className="mt-2 text-sm text-gray-400">
          The page you are looking for does not exist or has been moved.
        </p>

        <div className="mt-6 flex justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 rounded bg-amber-400 px-6 py-2 font-semibold text-gray-900 transition-colors hover:bg-amber-300"
          >
            <Home className="h-4 w-4" />
            Back to home
          </Link>
        </div>
      </AnimatedCard>
    </div>
  );
}
