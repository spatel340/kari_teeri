import { formatCardId } from "@kari-teeri/shared";
import type { Player, PublicGameState } from "@kari-teeri/shared";
import { Bot, Crown } from "lucide-react";
import { cn } from "@/utils/cn";

interface ScoreboardProps {
  players: Player[];
  game: PublicGameState | null;
}

export const Scoreboard = ({ players, game }: ScoreboardProps) => {
  const totals = game?.score.totals ?? {};
  const ordered = [...players].sort((left, right) => (totals[right.id] ?? 0) - (totals[left.id] ?? 0));
  const declarerName = game?.declarerId ? players.find((player) => player.id === game.declarerId)?.name ?? "Unknown" : null;

  return (
    <div className="glass rounded-[1.7rem] border border-white/10 p-4 shadow-glow">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.24em] text-gold-200/80">Scoreboard</p>
          <p className="text-sm text-slate-300">Running totals across the session.</p>
        </div>
        {game?.winningPlayerIds.length ? <Crown className="h-5 w-5 text-gold-200" /> : null}
      </div>
      {game ? (
        <div className="mb-4 rounded-[1.4rem] border border-white/8 bg-white/5 p-4">
          <p className="text-[11px] uppercase tracking-[0.24em] text-gold-200/80">Current Contract</p>
          <div className="mt-3 space-y-2 text-sm text-slate-300">
            <p>
              Declarer: <span className="font-semibold text-white">{declarerName ?? "Waiting"}</span>
            </p>
            <p>
              Bid: <span className="font-semibold text-white">{game.bidState?.currentBid ?? 150}</span>
            </p>
            <p>
              Trump: <span className="font-semibold capitalize text-white">{game.trumpSuit ?? "awaiting choice"}</span>
            </p>
            {game.calledPartners ? (
              <>
                <p>
                  Partner card{game.calledPartners.primaryCardIds.length > 1 ? "s" : ""}:{" "}
                  <span className="font-semibold text-white">{game.calledPartners.primaryCardIds.map((cardId) => formatCardId(cardId)).join(", ")}</span>
                </p>
                {game.calledPartners.backupCardIds.length ? (
                  <p>
                    Backup card{game.calledPartners.backupCardIds.length > 1 ? "s" : ""}:{" "}
                    <span className="font-semibold text-white">
                      {game.calledPartners.backupCardIds.map((cardId) => formatCardId(cardId)).join(", ")}
                    </span>
                  </p>
                ) : null}
              </>
            ) : (
              <p>
                Partner card: <span className="font-semibold text-white">awaiting call</span>
              </p>
            )}
          </div>
        </div>
      ) : null}
      <div className="space-y-2">
        {ordered.map((player, index) => (
          <div
            key={player.id}
            className={cn(
              "flex items-center justify-between rounded-2xl border px-3 py-2",
              index === 0 ? "border-gold-200/20 bg-gold-200/8" : "border-white/8 bg-white/5",
            )}
          >
            <div>
              <p className="text-sm font-semibold text-white">{player.name}</p>
              <p className="flex items-center gap-1 text-xs text-slate-400">
                {player.isBot ? <Bot className="h-3 w-3" /> : null}
                {player.isBot ? "Smart bot" : `Seat ${player.seatIndex + 1}`}
              </p>
            </div>
            <p className="text-lg font-semibold text-gold-200">{totals[player.id] ?? 0}</p>
          </div>
        ))}
      </div>
    </div>
  );
};
