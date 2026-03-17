import type { Player, PublicGameState } from "@kari-teeri/shared";
import { Badge } from "@/components/ui/Badge";
import { CardFace } from "@/components/CardFace";
import { arrangePlayersAroundLocal } from "@/utils/game";

interface TableCenterProps {
  players: Player[];
  meId: string;
  game: PublicGameState;
}

export const TableCenter = ({ players, meId, game }: TableCenterProps) => {
  const seated = arrangePlayersAroundLocal(players, meId);

  return (
    <div className="relative mx-auto flex h-[220px] w-full max-w-[480px] items-center justify-center rounded-full border border-white/10 bg-slate-950/25 px-6 py-8 shadow-[inset_0_0_40px_rgba(255,255,255,0.06)]">
      <div className="absolute left-1/2 top-5 -translate-x-1/2">
        <Badge tone="gold">Bid {game.bidState?.currentBid ?? 150}</Badge>
      </div>
      <div className="absolute bottom-5 left-1/2 -translate-x-1/2">
        {game.trumpSuit ? <Badge tone="emerald">Trump {game.trumpSuit}</Badge> : <Badge tone="slate">Awaiting Trump</Badge>}
      </div>
      <div className="grid grid-cols-2 gap-3">
        {seated.map((player) => {
          const playedCard = game.currentTrick?.cards.find((entry) => entry.playerId === player.id);
          return playedCard ? <CardFace key={player.id} card={playedCard.card} compact /> : null;
        })}
      </div>
    </div>
  );
};
