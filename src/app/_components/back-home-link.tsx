"use client";

import { motion } from "framer-motion";
import { usePathname, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

interface BackHomeLinkProps {
  className?: string;
}

export default function BackHomeLink({ className = "" }: BackHomeLinkProps) {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <motion.div
      initial={{ opacity: 0, y: -6, filter: "blur(2px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
    >
      <button
        type="button"
        onClick={() => {
          if (pathname === "/players") {
            router.push("/");
            return;
          }

          if (window.history.length > 1) {
            router.back();
            return;
          }

          router.push("/");
        }}
        className={`inline-flex cursor-pointer items-center gap-2 text-gray-400/90 transition-colors duration-200 hover:text-amber-300 ${className}`}
      >
        <ArrowLeft className="h-4 w-4" />
        <span className="text-sm">Back</span>
      </button>
    </motion.div>
  );
}
