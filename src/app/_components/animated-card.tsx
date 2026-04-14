"use client";

import { type ReactNode } from "react";
import { motion } from "framer-motion";

interface AnimatedCardProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  onClick?: () => void;
  href?: string;
  interactive?: boolean;
}

export default function AnimatedCard({
  children,
  className = "",
  delay = 0,
  onClick,
  href,
  interactive = false,
}: AnimatedCardProps) {
  const variants = {
    hidden: { opacity: 0, y: 10 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.16,
        delay: delay * 0.02,
      },
    },
  };

  const interactiveHover = {
    scale: 1.015,
    borderColor: "rgba(251, 191, 36, 0.5)",
    boxShadow:
      "0 0 0 1px rgba(251, 191, 36, 0.18), 0 8px 28px rgba(251, 191, 36, 0.16)",
    transition: {
      duration: 0.1,
    },
  };

  const content = (
    <motion.div
      initial="hidden"
      animate="visible"
      whileHover={interactive ? interactiveHover : undefined}
      variants={variants}
      className={`tm-card ${interactive ? "cursor-pointer" : ""} ${className}`}
      onClick={onClick}
    >
      {children}
    </motion.div>
  );

  if (href) {
    return (
      <a href={href} className="block">
        {content}
      </a>
    );
  }

  return content;
}
