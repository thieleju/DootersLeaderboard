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
    hidden: { opacity: 0, y: 18, scale: 0.985, filter: "blur(4px)" },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      filter: "blur(0px)",
      transition: {
        duration: 0.36,
        ease: [0.22, 1, 0.36, 1] as const,
        delay: delay * 0.08,
      },
    },
  };

  const content = (
    <motion.div
      initial="hidden"
      animate="visible"
      variants={variants}
      whileHover={interactive ? { y: -2, scale: 1.01 } : undefined}
      whileTap={interactive ? { scale: 0.995 } : undefined}
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
