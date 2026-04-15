export type UiTone = "amber" | "cyan" | "emerald" | "violet" | "gray";
export type CategoryTone = Exclude<UiTone, "gray">;

export const iconToneClasses: Record<UiTone, string> = {
  amber: "border-amber-400/30 bg-amber-400/10 text-amber-300",
  cyan: "border-cyan-400/30 bg-cyan-400/10 text-cyan-300",
  emerald: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
  violet: "border-violet-400/30 bg-violet-400/10 text-violet-300",
  gray: "border-gray-500/30 bg-gray-500/10 text-gray-300"
};

export const categoryToneClasses: Record<
  CategoryTone,
  {
    active: string;
    inactive: string;
    badge: string;
    icon: string;
  }
> = {
  amber: {
    active:
      "border-amber-300 bg-amber-400 text-gray-950 shadow-lg shadow-amber-400/20",
    inactive:
      "border-amber-300/25 bg-amber-400/10 text-amber-100 hover:border-amber-300 hover:bg-amber-400/20",
    badge: "border-amber-300/30 bg-amber-400/10 text-amber-200",
    icon: "text-amber-300"
  },
  cyan: {
    active:
      "border-cyan-300 bg-cyan-400 text-cyan-950 shadow-lg shadow-cyan-400/20",
    inactive:
      "border-cyan-300/25 bg-cyan-400/10 text-cyan-100 hover:border-cyan-300 hover:bg-cyan-400/20",
    badge: "border-cyan-300/30 bg-cyan-400/10 text-cyan-200",
    icon: "text-cyan-300"
  },
  emerald: {
    active:
      "border-emerald-300 bg-emerald-400 text-emerald-950 shadow-lg shadow-emerald-400/20",
    inactive:
      "border-emerald-300/25 bg-emerald-400/10 text-emerald-100 hover:border-emerald-300 hover:bg-emerald-400/20",
    badge: "border-emerald-300/30 bg-emerald-400/10 text-emerald-200",
    icon: "text-emerald-300"
  },
  violet: {
    active:
      "border-violet-300 bg-violet-400 text-violet-950 shadow-lg shadow-violet-400/20",
    inactive:
      "border-violet-300/25 bg-violet-400/10 text-violet-100 hover:border-violet-300 hover:bg-violet-400/20",
    badge: "border-violet-300/30 bg-violet-400/10 text-violet-200",
    icon: "text-violet-300"
  }
};

export const categoryBadgeClasses: Record<CategoryTone, string> = {
  amber: categoryToneClasses.amber.badge,
  cyan: categoryToneClasses.cyan.badge,
  emerald: categoryToneClasses.emerald.badge,
  violet: categoryToneClasses.violet.badge
};
