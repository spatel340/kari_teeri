import type { ButtonHTMLAttributes, PropsWithChildren } from "react";
import { cn } from "@/utils/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  fullWidth?: boolean;
}

const variantStyles: Record<Variant, string> = {
  primary:
    "bg-gradient-to-r from-gold-300 via-gold-200 to-gold-300 text-slate-950 shadow-[0_14px_34px_rgba(242,196,106,0.25)] hover:brightness-105",
  secondary:
    "bg-white/10 text-white ring-1 ring-white/10 hover:bg-white/15",
  ghost:
    "bg-transparent text-slate-200 ring-1 ring-white/8 hover:bg-white/6",
  danger:
    "bg-rose-500/14 text-rose-200 ring-1 ring-rose-400/18 hover:bg-rose-500/22",
};

export const Button = ({
  children,
  className,
  variant = "primary",
  fullWidth,
  ...props
}: PropsWithChildren<ButtonProps>) => (
  <button
    className={cn(
      "inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-45",
      variantStyles[variant],
      fullWidth && "w-full",
      className,
    )}
    {...props}
  >
    {children}
  </button>
);
