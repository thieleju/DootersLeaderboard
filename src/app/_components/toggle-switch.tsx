"use client";

import { motion } from "framer-motion";

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
}

export default function ToggleSwitch({
  checked,
  onChange,
  disabled = false,
  label
}: ToggleSwitchProps) {
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-all ${
          checked
            ? "bg-emerald-500/80 hover:bg-emerald-500"
            : "bg-gray-700 hover:bg-gray-600"
        } ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
      >
        <motion.div
          className="absolute h-5 w-5 rounded-full bg-white shadow-lg"
          animate={{ left: checked ? "calc(100% - 20px)" : "2px" }}
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
        />
      </button>
      {label && (
        <span
          className={`text-sm font-medium ${
            checked ? "text-emerald-300" : "text-gray-400"
          }`}
        >
          {label}
        </span>
      )}
    </div>
  );
}
