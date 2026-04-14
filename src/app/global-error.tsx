"use client";

import ErrorCard from "./_components/error-card";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="bg-gray-900 text-gray-100">
        <main className="flex min-h-screen items-center justify-center px-4 py-10">
          <ErrorCard onAction={reset} />
        </main>
      </body>
    </html>
  );
}
