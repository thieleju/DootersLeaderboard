"use client";

import { useEffect } from "react";

import ErrorCard from "./_components/error-card";

export default function Error({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex h-[calc(100vh-12rem)] items-center justify-center">
      <ErrorCard onAction={reset} />
    </div>
  );
}
