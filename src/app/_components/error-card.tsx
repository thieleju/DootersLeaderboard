"use client";

import { AlertTriangle, ArrowLeft } from "lucide-react";

import AnimatedCard from "./animated-card";

interface ErrorCardProps {
  title?: string;
  description?: string;
  onAction?: () => void;
}

export default function ErrorCard({
  title = "Something went wrong",
  description = "We're sorry, but an unexpected error has occurred.",
  onAction: onAction
}: ErrorCardProps) {
  return (
    <AnimatedCard className="mx-auto w-full max-w-md p-6 text-center shadow-2xl shadow-black/20">
      <div className="mb-4 flex justify-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-red-500/30 bg-red-500/10 text-red-300">
          <AlertTriangle className="h-6 w-6" />
        </div>
      </div>

      <h2 className="text-2xl font-bold text-white">{title}</h2>
      <p className="mt-2 text-sm text-gray-400">{description}</p>

      {onAction ? (
        <button
          type="button"
          onClick={onAction}
          className="mt-6 inline-flex items-center justify-center gap-2 rounded-lg bg-amber-400 px-5 py-3 font-semibold text-gray-900 transition-colors hover:bg-amber-300"
        >
          <ArrowLeft className="h-4 w-4" />
          Go back
        </button>
      ) : null}
    </AnimatedCard>
  );
}
