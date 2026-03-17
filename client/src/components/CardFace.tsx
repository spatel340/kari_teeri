import { motion } from "framer-motion";
import type { CSSProperties } from "react";
import type { Card } from "@kari-teeri/shared";
import { suitColorClass } from "@/utils/game";
import { cn } from "@/utils/cn";

interface CardFaceProps {
  card: Card;
  disabled?: boolean;
  interactive?: boolean;
  selected?: boolean;
  compact?: boolean;
  style?: CSSProperties;
  onClick?: () => void;
}

export const CardFace = ({ card, disabled, interactive, selected, compact, style, onClick }: CardFaceProps) => (
  <motion.button
    type="button"
    layout
    whileHover={interactive && !disabled ? { y: -10, rotate: 0 } : undefined}
    whileTap={interactive && !disabled ? { scale: 0.98 } : undefined}
    className={cn(
      "relative rounded-[1.35rem] border border-slate-300/90 bg-gradient-to-br from-white via-slate-50 to-slate-200 p-3 text-left text-slate-900 shadow-card transition",
      compact ? "h-24 w-16" : "h-36 w-24",
      disabled && "cursor-not-allowed opacity-35 saturate-50",
      interactive && !disabled && "cursor-pointer",
      selected && "ring-2 ring-gold-300",
    )}
    style={style}
    onClick={onClick}
    disabled={disabled}
  >
    <div className={cn("flex h-full flex-col justify-between", suitColorClass(card.suit))}>
      <div className="leading-none">
        <p className={cn("font-semibold", compact ? "text-sm" : "text-lg")}>{card.rank}</p>
        <p className={compact ? "text-sm" : "text-lg"}>{card.suit === "clubs" ? "♣" : card.suit === "diamonds" ? "♦" : card.suit === "hearts" ? "♥" : "♠"}</p>
      </div>
      <div className={cn("self-end font-display leading-none opacity-90", compact ? "text-xl" : "text-4xl")}>
        {card.suit === "clubs" ? "♣" : card.suit === "diamonds" ? "♦" : card.suit === "hearts" ? "♥" : "♠"}
      </div>
    </div>
    {card.id === "3S" ? (
      <span className="absolute right-2 top-2 rounded-full bg-slate-900/90 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-gold-300">
        Kali
      </span>
    ) : null}
  </motion.button>
);
