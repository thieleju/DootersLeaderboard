"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";

interface BackHomeLinkProps {
  className?: string;
}

export default function BackHomeLink({ className = "" }: BackHomeLinkProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -6, filter: "blur(2px)" }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
    >
      <Link
        href="/"
        className={`inline-flex items-center gap-2 text-gray-400/90 transition-colors duration-200 hover:text-amber-300 ${className}`}
      >
        <ArrowLeft className="h-4 w-4" />
        <span className="text-sm">Back</span>
      </Link>
    </motion.div>
  );
}
