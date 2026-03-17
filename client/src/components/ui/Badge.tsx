import type { PropsWithChildren } from "react";
import { cn } from "@/utils/cn";

interface BadgeProps {
  tone?: "gold" | "slate" | "emerald" | "rose";
  className?: string;
}

const toneClasses = {
  gold: "bg-gold-300/16 text-gold-200 ring-gold-200/15",
  slate: "bg-white/8 text-slate-200 ring-white/10",
  emerald: "bg-emerald-400/14 text-emerald-200 ring-emerald-300/15",
  rose: "bg-rose-400/12 text-rose-200 ring-rose-300/15",
} as const;

export const Badge = ({ children, tone = "slate", className }: PropsWithChildren<BadgeProps>) => (
  <span className={cn("inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium ring-1", toneClasses[tone], className)}>
    {children}
  </span>
);
