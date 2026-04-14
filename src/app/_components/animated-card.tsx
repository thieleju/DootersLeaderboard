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
    hidden: { opacity: 0, y: 6 },
    visible: {
      opacity: 1,
      y: 0,
      transition: {
        duration: 0.2,
        delay: delay * 0.015,
      },
    },
  };

  const content = (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={variants}
      className={`tm-card ${interactive ? "tm-card-interactive cursor-pointer" : ""} ${className}`}
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
