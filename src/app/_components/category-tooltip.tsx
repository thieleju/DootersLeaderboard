"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ExternalLink } from "lucide-react";

interface CategoryTooltipProps {
  label: string;
  description: string;
  link?: string | null;
  children: ReactNode;
  wrapperClassName?: string;
}

export default function CategoryTooltip({
  label,
  description,
  link,
  children,
  wrapperClassName = ""
}: CategoryTooltipProps) {
  const triggerRef = useRef<HTMLDivElement | null>(null);
  const openTimerRef = useRef<number | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const [mounted, setMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  useEffect(() => {
    setMounted(true);

    return () => {
      if (openTimerRef.current) {
        window.clearTimeout(openTimerRef.current);
      }
      if (closeTimerRef.current) {
        window.clearTimeout(closeTimerRef.current);
      }
    };
  }, []);

  const updatePosition = () => {
    if (!triggerRef.current) return;

    const rect = triggerRef.current.getBoundingClientRect();
    const tooltipWidth = 288; // Tailwind w-72
    const viewportPadding = 12;
    const minLeft = tooltipWidth / 2 + viewportPadding;
    const maxLeft = window.innerWidth - tooltipWidth / 2 - viewportPadding;

    const centerLeft = rect.left + rect.width / 2;
    const clampedLeft = Math.min(Math.max(centerLeft, minLeft), maxLeft);

    setPosition({
      top: rect.bottom + 8,
      left: clampedLeft
    });
  };

  const scheduleOpen = () => {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
    if (openTimerRef.current) {
      window.clearTimeout(openTimerRef.current);
    }

    openTimerRef.current = window.setTimeout(() => {
      updatePosition();
      setIsOpen(true);
    }, 500);
  };

  const scheduleClose = () => {
    if (openTimerRef.current) {
      window.clearTimeout(openTimerRef.current);
      openTimerRef.current = null;
    }
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
    }

    closeTimerRef.current = window.setTimeout(() => {
      setIsOpen(false);
    }, 80);
  };

  const keepOpen = () => {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  };

  const tooltip = (
    <div
      onMouseEnter={keepOpen}
      onMouseLeave={scheduleClose}
      className="fixed z-[80] w-72 -translate-x-1/2"
      style={{ top: position.top, left: position.left }}
    >
      <div className="rounded-lg border border-gray-700 bg-gray-900/95 p-3 text-left shadow-2xl shadow-black/35 backdrop-blur-sm">
        <div className="mb-1 text-xs font-semibold tracking-[0.14em] text-gray-500 uppercase">
          {label}
        </div>
        <p className="text-xs leading-relaxed text-gray-300">{description}</p>
        {link ? (
          <a
            href={link}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-amber-300 transition-colors hover:text-amber-200"
          >
            Rules
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        ) : null}
      </div>
    </div>
  );

  return (
    <div
      ref={triggerRef}
      onMouseEnter={scheduleOpen}
      onMouseLeave={scheduleClose}
      onFocus={scheduleOpen}
      onBlur={scheduleClose}
      className={`relative inline-flex w-fit ${wrapperClassName}`}
    >
      {children}
      {mounted && isOpen ? createPortal(tooltip, document.body) : null}
    </div>
  );
}
