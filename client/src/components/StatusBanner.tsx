import type { PublicGameState } from "@kari-teeri/shared";
import { Badge } from "@/components/ui/Badge";

interface StatusBannerProps {
  game: PublicGameState | null;
}

export const StatusBanner = ({ game }: StatusBannerProps) => (
  <div className="glass flex items-center justify-between gap-3 rounded-[1.6rem] border border-white/10 px-4 py-3 shadow-glow">
    <div>
      <p className="text-[11px] uppercase tracking-[0.28em] text-gold-200/80">Table State</p>
      <p className="text-sm text-slate-100">{game?.statusText ?? "Gather the room and prepare the table."}</p>
    </div>
    {game ? <Badge tone="gold">{game.phase.replace("-", " ")}</Badge> : <Badge tone="slate">Lobby</Badge>}
  </div>
);
