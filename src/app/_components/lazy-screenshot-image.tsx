"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { AlertCircle, Loader2 } from "lucide-react";
import { api } from "~/trpc/react";
import Image from "next/image";

type LazyScreenshotImageProps = {
  runId: string;
  alt?: string;
  className?: string;
  onLoad?: () => void;
};

export default function LazyScreenshotImage({
  runId,
  alt = "Screenshot",
  className = "w-full h-auto",
  onLoad
}: LazyScreenshotImageProps) {
  const [screenshotBase64, setScreenshotBase64] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const {
    data,
    isLoading: isFetching,
    error: fetchError
  } = api.players.getRunScreenshot.useQuery(
    {
      runId
    },
    {
      enabled: isLoading && !screenshotBase64 && !error,
      staleTime: Infinity, // Screenshots don't change
      gcTime: 1000 * 60 * 60 // Cache for 1 hour
    }
  );

  useEffect(() => {
    if (!data) return;
    setScreenshotBase64(data.screenshotBase64 ?? null);
    setIsLoading(false);
    setError(null);
    if (data.screenshotBase64) {
      onLoad?.();
    }
  }, [data, onLoad]);

  useEffect(() => {
    if (fetchError) {
      setError("Failed to load screenshot");
      setIsLoading(false);
    }
  }, [fetchError]);

  if (isLoading || isFetching) {
    return (
      <motion.div
        className="relative isolate aspect-video w-full overflow-hidden rounded-xl border border-gray-700/70 bg-slate-950/70"
        initial={{ opacity: 0, scale: 0.985 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.24, ease: "easeOut" }}
      >
        <motion.div
          className="absolute inset-y-0 -left-1/3 w-1/3 bg-gradient-to-r from-transparent via-white/14 to-transparent"
          animate={{ x: ["-10%", "380%"] }}
          transition={{ duration: 1.35, repeat: Infinity, ease: "easeInOut" }}
        />

        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(56,189,248,0.2),transparent_45%),radial-gradient(circle_at_70%_80%,rgba(251,191,36,0.12),transparent_45%)]" />

        <div className="relative z-10 flex h-full w-full flex-col items-center justify-center gap-3">
          <motion.div
            className="flex h-14 w-14 items-center justify-center rounded-full border border-sky-200/25 bg-slate-900/70"
            animate={{ scale: [1, 1.06, 1], opacity: [0.8, 1, 0.8] }}
            transition={{ duration: 1.15, repeat: Infinity, ease: "easeInOut" }}
          >
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1.6, repeat: Infinity, ease: "linear" }}
            >
              <Loader2 className="h-6 w-6 text-sky-200" />
            </motion.div>
          </motion.div>

          <div className="flex items-center gap-1.5">
            {[0, 1, 2].map((dot) => (
              <motion.span
                key={dot}
                className="h-1.5 w-1.5 rounded-full bg-sky-200/70"
                animate={{ y: [0, -4, 0], opacity: [0.4, 1, 0.4] }}
                transition={{
                  duration: 0.7,
                  repeat: Infinity,
                  ease: "easeInOut",
                  delay: dot * 0.12
                }}
              />
            ))}
          </div>
        </div>
      </motion.div>
    );
  }

  if (error || !screenshotBase64) {
    return (
      <motion.div
        className={`flex items-center justify-center gap-2 rounded border border-red-200 bg-red-50 ${className}`}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
      >
        <AlertCircle className="h-5 w-5 flex-shrink-0 text-red-400" />
        <span className="text-sm text-red-600">
          {error ?? "No screenshot found"}
        </span>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <Image
        src={screenshotBase64}
        alt={alt}
        width={1280}
        height={720}
        unoptimized
        className={className}
        onLoad={() => onLoad?.()}
      />
    </motion.div>
  );
}
