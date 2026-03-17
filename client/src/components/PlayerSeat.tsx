import { Bot, Crown, WifiOff } from "lucide-react";
import type { Player } from "@kari-teeri/shared";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/utils/cn";
import { getInitials } from "@/utils/game";

interface PlayerSeatProps {
  player: Player;
  score: number;
  isCurrentTurn?: boolean;
  isDealer?: boolean;
  isDeclarer?: boolean;
  isRevealedPartner?: boolean;
  isLocal?: boolean;
}

export const PlayerSeat = ({
  player,
  score,
  isCurrentTurn,
  isDealer,
  isDeclarer,
  isRevealedPartner,
  isLocal,
}: PlayerSeatProps) => (
  <div
    className={cn(
      "glass min-w-[150px] rounded-[1.6rem] border px-4 py-3 shadow-glow transition",
      isCurrentTurn ? "border-gold-200/45 ring-1 ring-gold-200/35" : "border-white/10",
      isLocal && "bg-slate-950/82",
    )}
  >
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-center gap-3">
        <div
          className="flex h-11 w-11 items-center justify-center rounded-2xl text-sm font-semibold text-white shadow-lg"
          style={{ background: `linear-gradient(135deg, hsla(${player.avatarHue}, 70%, 55%, 0.95), hsla(${(player.avatarHue + 60) % 360}, 70%, 45%, 0.95))` }}
        >
          {getInitials(player.name)}
        </div>
        <div>
          <p className="text-sm font-semibold text-white">{player.name}</p>
          <p className="text-xs text-slate-400">Score {score}</p>
        </div>
      </div>
      {!player.isConnected ? <WifiOff className="h-4 w-4 text-amber-300" /> : null}
    </div>
    <div className="mt-3 flex flex-wrap gap-2">
      {player.isHost ? (
        <Badge tone="gold" className="gap-1">
          <Crown className="h-3.5 w-3.5" />
          Host
        </Badge>
      ) : null}
      {player.isBot ? (
        <Badge tone="slate" className="gap-1">
          <Bot className="h-3.5 w-3.5" />
          Smart
        </Badge>
      ) : null}
      {isDealer ? <Badge tone="emerald">Dealer</Badge> : null}
      {isCurrentTurn ? <Badge tone="gold">Turn</Badge> : null}
      {isDeclarer ? <Badge tone="rose">Declarer</Badge> : null}
      {isRevealedPartner ? <Badge tone="emerald">Revealed Partner</Badge> : null}
    </div>
  </div>
);
