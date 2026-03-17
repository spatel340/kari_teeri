import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Bot, Clipboard, Crown, Eye, EyeOff, Minus, Plus, RefreshCcw, Share2, Sparkles, Users } from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { MIN_PLAYERS, PLAYER_OPTIONS, RANKS, REMOVED_TWOS_BY_PLAYER_COUNT, SUITS, createCard, formatCardId } from "@kari-teeri/shared";
import type { Card, CardId, Player, PlayerRole, PublicGameState, RoomSettings, Suit, UpdateSettingsInput } from "@kari-teeri/shared";
import { CardFace } from "@/components/CardFace";
import { EventLog } from "@/components/EventLog";
import { PlayerSeat } from "@/components/PlayerSeat";
import { Scoreboard } from "@/components/Scoreboard";
import { StatusBanner } from "@/components/StatusBanner";
import { TableCenter } from "@/components/TableCenter";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useGameSession } from "@/hooks/useGameSession";
import { getStoredName } from "@/lib/storage";
import { arrangePlayersAroundLocal, getRoleLabel, getSeatPlacement, suitSymbol } from "@/utils/game";

const validateName = (name: string): string | null => {
  if (!name.trim()) {
    return "Enter your name before joining this room.";
  }

  if (name.trim().length < 2) {
    return "Names should be at least two characters.";
  }

  return null;
};

const copyText = async (value: string) => {
  await navigator.clipboard.writeText(value);
};

const buildInviteLink = (roomCode: string): string => `${window.location.origin}/room/${roomCode}`;

const buildEligiblePartnerCards = (playerCount: number, hand: Card[]): Card[] => {
  const removedIds = new Set(REMOVED_TWOS_BY_PLAYER_COUNT[playerCount] ?? []);
  const handIds = new Set(hand.map((card) => card.id));

  return SUITS.flatMap((suit) =>
    RANKS.map((rank) => createCard(rank, suit)).filter((card) => !removedIds.has(card.id) && !handIds.has(card.id)),
  );
};

const groupCardsBySuit = (cards: Card[]) =>
  SUITS.map((suit) => ({
    suit,
    cards: cards.filter((card) => card.suit === suit),
  })).filter((entry) => entry.cards.length > 0);

const BiddingPanel = ({
  visible,
  game,
  players,
  meId,
  onPass,
  onBid,
  onToggle,
}: {
  visible: boolean;
  game: PublicGameState;
  players: Player[];
  meId: string;
  onPass: () => void;
  onBid: (amount: number) => void;
  onToggle: () => void;
}) => {
  const minimumNextBid = game.bidState?.currentBid ? game.bidState.currentBid + 5 : 150;
  const [amount, setAmount] = useState(minimumNextBid);

  useEffect(() => {
    setAmount(minimumNextBid);
  }, [minimumNextBid]);

  const activePlayerName = players.find((player) => player.id === game.bidState?.activePlayerId)?.name ?? "Waiting";
  const myTurn = game.bidState?.activePlayerId === meId;

  return (
    <AnimatePresence initial={false} mode="wait">
      {visible ? (
        <motion.div
          key="bidding-open"
          initial={{ opacity: 0, x: 18, y: 18 }}
          animate={{ opacity: 1, x: 0, y: 0 }}
          exit={{ opacity: 0, x: 18, y: 18 }}
          className="fixed right-4 top-24 z-40 w-[min(92vw,32rem)]"
        >
          <div className="glass rounded-[2rem] border border-white/10 p-5 shadow-glow">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] uppercase tracking-[0.24em] text-gold-200/80">Bidding Table</p>
                <h2 className="mt-2 font-display text-3xl text-white">Auction</h2>
                <p className="mt-2 text-sm text-slate-300">Hide this panel any time to inspect your hand, then reopen it to bid.</p>
              </div>
              <Button variant="ghost" className="shrink-0 px-3 py-2" onClick={onToggle}>
                <EyeOff className="h-4 w-4" />
                Hide
              </Button>
            </div>

            <div className="grid gap-4">
              <div className="rounded-[1.5rem] border border-white/8 bg-white/5 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.24em] text-gold-200/80">Current High</p>
                    <p className="mt-2 font-display text-4xl text-white">{game.bidState?.currentBid ?? 150}</p>
                  </div>
                  <Badge tone="gold">{activePlayerName} to act</Badge>
                </div>
                <p className="mt-3 text-sm text-slate-300">
                  {game.bidState?.highestBidderId
                    ? `${players.find((player) => player.id === game.bidState?.highestBidderId)?.name} is leading the auction.`
                    : "No bid has landed yet."}
                </p>
                {myTurn ? (
                  <div className="mt-4 space-y-3">
                    <label className="text-sm text-slate-300">Your bid</label>
                    <input
                      type="range"
                      min={minimumNextBid}
                      max={250}
                      step={5}
                      value={amount}
                      onChange={(event) => setAmount(Number(event.target.value))}
                      className="w-full"
                    />
                    <div className="rounded-2xl border border-gold-200/20 bg-gold-200/8 px-3 py-2 text-center font-semibold text-gold-200">
                      {amount}
                    </div>
                    <div className="flex flex-wrap justify-end gap-3">
                      <Button variant="ghost" onClick={onPass}>
                        Pass
                      </Button>
                      <Button onClick={() => onBid(amount)}>Bid {amount}</Button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-4">
                    <Badge tone="slate">Waiting for your turn</Badge>
                  </div>
                )}
              </div>

              <div className="rounded-[1.5rem] border border-white/8 bg-white/5 p-4">
                <p className="mb-3 text-[11px] uppercase tracking-[0.24em] text-gold-200/80">Auction Log</p>
                <div className="max-h-60 space-y-2 overflow-y-auto pr-1">
                  {game.bidState?.history.length ? (
                    game.bidState.history.map((entry) => (
                      <div key={entry.id} className="rounded-2xl border border-white/8 bg-slate-950/40 px-3 py-2 text-sm text-slate-200">
                        {players.find((player) => player.id === entry.playerId)?.name} {entry.type === "bid" ? `bid ${entry.amount}` : "passed"}
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-white/8 bg-slate-950/40 px-3 py-2 text-sm text-slate-400">
                      Auction opens at 150. Study your hand, then decide whether to push higher.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      ) : (
        <motion.div
          key="bidding-closed"
          initial={{ opacity: 0, x: 18, y: 18 }}
          animate={{ opacity: 1, x: 0, y: 0 }}
          exit={{ opacity: 0, x: 18, y: 18 }}
          className="fixed bottom-6 right-5 z-40"
        >
          <Button
            variant={myTurn ? "primary" : "secondary"}
            className="rounded-full px-5 py-3 shadow-glow"
            onClick={onToggle}
          >
            <Eye className="h-4 w-4" />
            Show Bidding
          </Button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

const PartnerSelectionModal = ({
  open,
  cards,
  requiredPartners,
  onSubmit,
}: {
  open: boolean;
  cards: Card[];
  requiredPartners: 1 | 2;
  onSubmit: (primaryCardIds: CardId[], backupCardIds: CardId[]) => void;
}) => {
  const [primary, setPrimary] = useState<CardId[]>([]);
  const [backup, setBackup] = useState<CardId[]>([]);

  useEffect(() => {
    setPrimary([]);
    setBackup([]);
  }, [open]);

  const togglePrimary = (cardId: CardId) => {
    const maxPrimary = requiredPartners === 1 ? 1 : 2;
    setBackup((current) => current.filter((entry) => entry !== cardId));
    setPrimary((current) =>
      current.includes(cardId)
        ? current.filter((entry) => entry !== cardId)
        : current.length < maxPrimary
          ? [...current, cardId]
          : [...current.slice(1), cardId],
    );
  };

  const toggleBackup = (cardId: CardId) => {
    if (primary.includes(cardId)) {
      return;
    }

    setBackup((current) =>
      current.includes(cardId)
        ? current.filter((entry) => entry !== cardId)
        : current.length < 2
          ? [...current, cardId]
          : current,
    );
  };

  const maxPrimary = requiredPartners === 1 ? 1 : 2;
  const canSubmit = primary.length === maxPrimary && (requiredPartners === 1 || backup.length === 2);

  return (
    <Modal
      open={open}
      title="Call The Partner Cards"
      description={
        requiredPartners === 1
          ? "Choose one partner card from the active deck that is not in your own hand."
          : "Choose two primary cards and two backups. The engine resolves two distinct partners in order."
      }
      footer={<Button onClick={() => onSubmit(primary, backup)} disabled={!canSubmit}>Confirm Cards</Button>}
      className="max-w-4xl"
    >
      <div className="grid gap-4 lg:grid-cols-[0.34fr_1fr]">
        <div className="space-y-3 rounded-[1.5rem] border border-white/8 bg-white/5 p-4 text-sm text-slate-300">
          <div>
            <p className="text-[11px] uppercase tracking-[0.24em] text-gold-200/80">Selection</p>
            <p className="mt-2">Primary: {primary.map((cardId) => formatCardId(cardId)).join(", ") || "None"}</p>
            {requiredPartners === 2 ? <p className="mt-2">Backup: {backup.map((cardId) => formatCardId(cardId)).join(", ") || "None"}</p> : null}
          </div>
          <p>
            Click the card to set it as primary.
            {requiredPartners === 2 ? " Use the backup button underneath to place alternates." : ""}
          </p>
        </div>

        <div className="max-h-[60vh] overflow-y-auto pr-1">
          {groupCardsBySuit(cards).map((entry) => (
            <div key={entry.suit} className="mb-4 rounded-[1.5rem] border border-white/8 bg-white/5 p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="font-semibold capitalize text-white">{entry.suit}</p>
                <Badge tone="slate">{suitSymbol(entry.suit)}</Badge>
              </div>
              <div className="flex flex-wrap gap-3">
                {entry.cards.map((card) => (
                  <div key={card.id} className="space-y-2">
                    <CardFace
                      card={card}
                      compact
                      selected={primary.includes(card.id) || backup.includes(card.id)}
                      interactive
                      onClick={() => togglePrimary(card.id)}
                    />
                    {requiredPartners === 2 ? (
                      <Button
                        variant={backup.includes(card.id) ? "primary" : "ghost"}
                        className="w-full px-2 py-2 text-xs"
                        onClick={() => toggleBackup(card.id)}
                      >
                        Backup
                      </Button>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
};

const TrumpSelectionModal = ({
  open,
  onSelect,
}: {
  open: boolean;
  onSelect: (suit: Suit) => void;
}) => (
  <Modal open={open} title="Choose The Sir" description="Name the trump suit for this hand.">
    <div className="grid gap-3 sm:grid-cols-2">
      {SUITS.map((suit) => (
        <Button key={suit} variant="secondary" className="justify-between py-5 text-base capitalize" onClick={() => onSelect(suit)}>
          {suit}
          <span className="text-2xl">{suitSymbol(suit)}</span>
        </Button>
      ))}
    </div>
  </Modal>
);

const SummaryModal = ({
  open,
  game,
  players,
  isHost,
  onContinue,
  onReturnToLobby,
}: {
  open: boolean;
  game: PublicGameState;
  players: Player[];
  isHost: boolean;
  onContinue: () => void;
  onReturnToLobby: () => void;
}) => {
  const summary = game.score.lastSummary;

  if (!summary) {
    return null;
  }

  const findName = (playerId: string) => players.find((player) => player.id === playerId)?.name ?? "Unknown";
  const isGameOver = game.phase === "game-over";

  return (
    <Modal
      open={open}
      title={isGameOver ? "Final Table" : `Hand ${summary.handNumber} Summary`}
      description={isGameOver ? "The session is complete." : "The hand is scored and ready for the next deal."}
      footer={
        isHost ? (
          isGameOver ? (
            <Button onClick={onReturnToLobby}>Return To Lobby</Button>
          ) : (
            <Button onClick={onContinue}>Deal Next Hand</Button>
          )
        ) : (
          <Badge tone="slate">Waiting for the host</Badge>
        )
      }
      className="max-w-4xl"
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3 rounded-[1.5rem] border border-white/8 bg-white/5 p-4">
          <p className="text-[11px] uppercase tracking-[0.24em] text-gold-200/80">Contract</p>
          <p className="text-sm text-slate-300">Declarer: <span className="font-semibold text-white">{findName(summary.declarerId)}</span></p>
          <p className="text-sm text-slate-300">Bid: <span className="font-semibold text-white">{summary.bid}</span></p>
          <p className="text-sm text-slate-300">Trump: <span className="font-semibold text-white capitalize">{summary.trumpSuit}</span></p>
          <p className="text-sm text-slate-300">Called cards: <span className="font-semibold text-white">{summary.calledPartners.primaryCardIds.map(formatCardId).join(", ")}</span></p>
          {summary.calledPartners.backupCardIds.length ? (
            <p className="text-sm text-slate-300">Backup cards: <span className="font-semibold text-white">{summary.calledPartners.backupCardIds.map(formatCardId).join(", ")}</span></p>
          ) : null}
          <p className="text-sm text-slate-300">Resolved partners: <span className="font-semibold text-white">{summary.actualPartnerIds.map(findName).join(", ")}</span></p>
        </div>

        <div className="space-y-3 rounded-[1.5rem] border border-white/8 bg-white/5 p-4">
          <p className="text-[11px] uppercase tracking-[0.24em] text-gold-200/80">Scoring</p>
          <p className="text-sm text-slate-300">Declarer side trick points: <span className="font-semibold text-white">{summary.declarerTeamPoints}</span></p>
          <p className="text-sm text-slate-300">Opponent trick points: <span className="font-semibold text-white">{summary.opponentPoints}</span></p>
          <p className="text-sm text-slate-300">Bid result: <span className="font-semibold text-white">{summary.bidSucceeded ? "Made" : "Set"}</span></p>
          <p className="text-sm text-slate-300">Declarer side hand score: <span className="font-semibold text-white">{summary.scoreAwarded.declarerTeam}</span></p>
          <p className="text-sm text-slate-300">Opposition hand score: <span className="font-semibold text-white">{summary.scoreAwarded.opponents}</span></p>
        </div>
      </div>

      <div className="mt-4 rounded-[1.5rem] border border-white/8 bg-white/5 p-4">
        <p className="mb-3 text-[11px] uppercase tracking-[0.24em] text-gold-200/80">Running Totals</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Object.entries(summary.totals)
            .sort((left, right) => right[1] - left[1])
            .map(([playerId, total]) => (
              <div key={playerId} className="rounded-2xl border border-white/8 bg-slate-950/35 px-3 py-2">
                <p className="text-sm font-semibold text-white">{findName(playerId)}</p>
                <p className="text-lg text-gold-200">{total}</p>
              </div>
            ))}
        </div>
      </div>
    </Modal>
  );
};

const LobbyView = ({
  roomCode,
  players,
  settings,
  meId,
  isHost,
  pending,
  onLeave,
  onStart,
  onSettingsChange,
  onAddSmartBot,
  onRemoveSmartBot,
}: {
  roomCode: string;
  players: Player[];
  settings: RoomSettings;
  meId: string;
  isHost: boolean;
  pending: boolean;
  onLeave: () => void;
  onStart: () => void;
  onSettingsChange: (field: "maxPlayers" | "targetScore" | "rounds" | "gameMode", value: string) => void;
  onAddSmartBot: (count?: number) => void;
  onRemoveSmartBot: (botPlayerId?: string) => void;
}) => {
  const inviteLink = buildInviteLink(roomCode);
  const botPlayers = players.filter((player) => player.isBot);
  const missingToStart = Math.max(0, MIN_PLAYERS - players.length);
  const missingToMax = Math.max(0, settings.maxPlayers - players.length);

  const handleShare = async () => {
    if (navigator.share) {
      await navigator.share({
        title: "Join my Kari Teeri room",
        text: `Join room ${roomCode}`,
        url: inviteLink,
      });
      return;
    }

    await copyText(inviteLink);
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
      <div className="space-y-6">
        <StatusBanner game={null} />

        <div className="glass rounded-[2rem] border border-white/10 p-6 shadow-glow">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.28em] text-gold-200/80">Room Code</p>
              <h2 className="mt-2 font-display text-5xl tracking-[0.18em] text-white">{roomCode}</h2>
              <p className="mt-3 max-w-2xl text-sm text-slate-300">
                Share the invite link or room code. The room lives only while seats remain occupied.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Button variant="secondary" onClick={() => copyText(inviteLink)}>
                <Clipboard className="h-4 w-4" />
                Copy Invite Link
              </Button>
              <Button variant="secondary" onClick={() => copyText(roomCode)}>
                <Clipboard className="h-4 w-4" />
                Copy Room Code
              </Button>
              <Button variant="ghost" onClick={handleShare}>
                <Share2 className="h-4 w-4" />
                Share
              </Button>
              <Button variant="danger" onClick={onLeave}>
                Leave
              </Button>
            </div>
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {players.map((player) => (
              <div key={player.id} className="rounded-[1.6rem] border border-white/8 bg-white/5 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white">{player.name}</p>
                    <p className="text-xs text-slate-400">
                      {player.id === meId ? "You" : player.isBot ? "Smart bot seat" : `Seat ${player.seatIndex + 1}`}
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    {player.isHost ? <Badge tone="gold"><Crown className="mr-1 h-3 w-3" />Host</Badge> : null}
                    {player.isBot ? <Badge tone="slate"><Bot className="mr-1 h-3 w-3" />Smart</Badge> : null}
                  </div>
                </div>
                {player.isBot ? (
                  <div className="mt-3">
                    <Button variant="ghost" className="w-full justify-center px-3 py-2 text-xs" onClick={() => onRemoveSmartBot(player.id)}>
                      <Minus className="h-3.5 w-3.5" />
                      Remove Bot
                    </Button>
                  </div>
                ) : null}
              </div>
            ))}
            <motion.div
              className="rounded-[1.6rem] border border-dashed border-gold-200/18 bg-gold-200/5 p-4"
              animate={{ opacity: [0.7, 1, 0.7] }}
              transition={{ repeat: Number.POSITIVE_INFINITY, duration: 2.4 }}
            >
              <p className="text-sm font-semibold text-white">Waiting for more players</p>
              <p className="mt-2 text-sm text-slate-400">{players.length}/{settings.maxPlayers} seats filled</p>
            </motion.div>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div className="glass rounded-[2rem] border border-white/10 p-6 shadow-glow">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.24em] text-gold-200/80">Room Settings</p>
              <p className="text-sm text-slate-300">Host-controlled table configuration.</p>
            </div>
            {isHost ? <Badge tone="gold">Host Controls</Badge> : <Badge tone="slate">Read Only</Badge>}
          </div>
          <div className="space-y-4">
            <label className="block space-y-2">
              <span className="text-sm text-slate-300">Max players</span>
              <select
                disabled={!isHost}
                className="w-full rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3 text-white"
                onChange={(event) => onSettingsChange("maxPlayers", event.target.value)}
                value={settings.maxPlayers}
              >
                {PLAYER_OPTIONS.map((count) => (
                  <option key={count} value={count}>
                    {count}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-2">
              <span className="text-sm text-slate-300">Game mode</span>
              <div className="grid gap-3 sm:grid-cols-2">
                <Button variant={settings.gameMode === "target-score" ? "primary" : "secondary"} disabled={!isHost} onClick={() => onSettingsChange("gameMode", "target-score")}>
                  Target Score
                </Button>
                <Button variant={settings.gameMode === "rounds" ? "primary" : "secondary"} disabled={!isHost} onClick={() => onSettingsChange("gameMode", "rounds")}>
                  Rounds
                </Button>
              </div>
            </label>
            <label className="block space-y-2">
              <span className="text-sm text-slate-300">Target score</span>
              <input
                type="number"
                min={250}
                step={50}
                disabled={!isHost}
                onChange={(event) => onSettingsChange("targetScore", event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3 text-white"
                value={settings.targetScore}
              />
            </label>
            <label className="block space-y-2">
              <span className="text-sm text-slate-300">Rounds</span>
              <input
                type="number"
                min={1}
                max={20}
                disabled={!isHost}
                onChange={(event) => onSettingsChange("rounds", event.target.value)}
                className="w-full rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3 text-white"
                value={settings.rounds}
              />
            </label>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button onClick={onStart} disabled={!isHost || players.length < MIN_PLAYERS || pending}>
              <Sparkles className="h-4 w-4" />
              Start Game
            </Button>
            {!isHost ? <p className="text-sm text-slate-400">Only the host can begin when at least four players are seated.</p> : null}
          </div>
        </div>

        <div className="glass rounded-[2rem] border border-white/10 p-6 shadow-glow">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-[0.24em] text-gold-200/80">Smart Bots</p>
              <p className="text-sm text-slate-300">Fill empty seats for solo runs or short-handed games. Human joiners can still reclaim a bot seat in the lobby.</p>
            </div>
            <Badge tone="emerald">{botPlayers.length} active</Badge>
          </div>
          <div className="rounded-[1.5rem] border border-white/8 bg-white/5 p-4">
            <p className="text-sm text-slate-200">
              {missingToStart > 0
                ? `${missingToStart} more ${missingToStart === 1 ? "seat" : "seats"} needed before the table can start.`
                : "The table already has enough seats filled to start."}
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Button variant="secondary" onClick={() => onAddSmartBot(1)} disabled={pending || players.length >= settings.maxPlayers}>
                <Plus className="h-4 w-4" />
                Add Smart Bot
              </Button>
              <Button
                variant="ghost"
                onClick={() => onAddSmartBot(missingToStart)}
                disabled={pending || missingToStart === 0 || players.length >= settings.maxPlayers}
              >
                <Sparkles className="h-4 w-4" />
                Fill To Start
              </Button>
              <Button
                variant="ghost"
                onClick={() => onAddSmartBot(missingToMax)}
                disabled={pending || missingToMax === 0}
              >
                <Bot className="h-4 w-4" />
                Fill To Max
              </Button>
              <Button variant="ghost" onClick={() => onRemoveSmartBot()} disabled={pending || botPlayers.length === 0}>
                <Minus className="h-4 w-4" />
                Remove Last Bot
              </Button>
            </div>
          </div>
        </div>

        <div className="glass rounded-[2rem] border border-white/10 p-6 shadow-glow">
          <p className="text-[11px] uppercase tracking-[0.24em] text-gold-200/80">Waiting Table</p>
          <p className="mt-2 text-sm text-slate-300">Fresh rooms expire automatically when the last player leaves.</p>
          <div className="mt-4 flex items-center gap-3">
            <div className="h-20 w-14 animate-float rounded-[1.4rem] border border-white/10 bg-white/5" />
            <div className="h-20 w-14 animate-float rounded-[1.4rem] border border-white/10 bg-white/5 [animation-delay:200ms]" />
            <div className="h-20 w-14 animate-float rounded-[1.4rem] border border-white/10 bg-white/5 [animation-delay:400ms]" />
          </div>
        </div>
      </div>
    </div>
  );
};

const TableView = ({
  players,
  meId,
  game,
  hand,
  legalCardIds,
  meRole,
  secretNotice,
  knownPartnerIds,
  notifications,
  onPlayCard,
}: {
  players: Player[];
  meId: string;
  game: PublicGameState;
  hand: Card[];
  legalCardIds: CardId[];
  meRole: PlayerRole;
  secretNotice: string | null;
  knownPartnerIds: string[];
  notifications: Array<{ id: string; message: string; tone: "neutral" | "success" | "warning"; timestamp: number }>;
  onPlayCard: (cardId: CardId) => void;
}) => {
  const seatedPlayers = arrangePlayersAroundLocal(players, meId);
  const scoreTotals = game.score.totals;

  return (
    <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
      <div className="space-y-5">
        <StatusBanner game={game} />

        <div className="felt-table relative min-h-[720px] overflow-hidden rounded-[2.4rem] border border-white/10 p-5 shadow-felt">
          {seatedPlayers.map((player, index) => {
            const placement = getSeatPlacement(seatedPlayers.length, index);
            return (
              <div key={player.id} className="absolute w-[min(19rem,32vw)]" style={placement}>
                <PlayerSeat
                  player={player}
                  score={scoreTotals[player.id] ?? 0}
                  isLocal={player.id === meId}
                  isCurrentTurn={game.turnPlayerId === player.id}
                  isDealer={game.dealerId === player.id}
                  isDeclarer={game.declarerId === player.id}
                  isRevealedPartner={game.revealedPartnerIds.includes(player.id) || knownPartnerIds.includes(player.id)}
                />
              </div>
            );
          })}

          <div className="absolute inset-0 flex items-center justify-center px-4">
            <TableCenter players={players} meId={meId} game={game} />
          </div>

          <div className="absolute left-6 top-6 flex flex-wrap gap-2">
            <Badge tone="gold">{getRoleLabel(meRole)}</Badge>
            <Badge tone="slate">Hand {game.handNumber}</Badge>
            {game.trumpSuit ? <Badge tone="emerald">Trump {game.trumpSuit}</Badge> : null}
            {game.calledPartners ? <Badge tone="slate">Called {game.calledPartners.primaryCardIds.map(formatCardId).join(", ")}</Badge> : null}
          </div>

          {secretNotice ? (
            <div className="absolute right-6 top-6 max-w-xs rounded-[1.2rem] border border-emerald-300/20 bg-emerald-400/10 px-3 py-2 text-sm text-emerald-100 shadow-glow">
              {secretNotice}
            </div>
          ) : null}

          <div className="absolute bottom-4 left-1/2 w-full max-w-[900px] -translate-x-1/2 px-3 sm:px-8">
            <div className="mb-3 flex items-center justify-between px-2">
              <div>
                <p className="text-[11px] uppercase tracking-[0.24em] text-gold-200/80">Your Hand</p>
                <p className="text-sm text-slate-300">
                  {game.turnPlayerId === meId ? "Play a legal card." : "Waiting for your turn."}
                </p>
              </div>
              <Badge tone="slate">{hand.length} cards</Badge>
            </div>
            <div className="relative flex min-h-[170px] items-end justify-center">
              {hand.map((card, index) => {
                const middle = (hand.length - 1) / 2;
                const offset = index - middle;
                const playable = legalCardIds.includes(card.id);

                return (
                  <CardFace
                    key={card.id}
                    card={card}
                    interactive
                    disabled={!playable}
                    onClick={() => playable && onPlayCard(card.id)}
                    style={{
                      marginLeft: index === 0 ? 0 : "-56px",
                      transform: `translateY(${Math.abs(offset) * 6}px) rotate(${offset * 5}deg)`,
                      zIndex: index + 1,
                    }}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <Scoreboard players={players} game={game} />
        <EventLog notifications={notifications} />
      </div>
    </div>
  );
};

export const RoomScreen = () => {
  const navigate = useNavigate();
  const { roomCode: routeRoomCode = "" } = useParams();
  const roomCode = routeRoomCode.toUpperCase();
  const {
    snapshot,
    session,
    error,
    expired,
    pending,
    reconnectRoom,
    joinRoom,
    leaveRoom,
    updateSettings,
    addSmartBot,
    removeSmartBot,
    startGame,
    submitBid,
    selectPartners,
    selectTrump,
    playCard,
    continueGame,
    returnToLobby,
    clearError,
  } = useGameSession();
  const [joinName, setJoinName] = useState(() => getStoredName());
  const [localError, setLocalError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [showBiddingPanel, setShowBiddingPanel] = useState(true);

  const activeSnapshot = snapshot?.room.code === roomCode ? snapshot : null;
  const currentGame = activeSnapshot?.room.game ?? null;
  const me = activeSnapshot?.me ?? null;
  const players = activeSnapshot?.room.players ?? [];
  const mePlayer = players.find((player) => player.id === me?.playerId);
  const isHost = Boolean(mePlayer?.isHost);
  const visibleError = localError ?? error?.message ?? null;

  useEffect(() => {
    if (!roomCode) {
      navigate("/");
      return;
    }

    if (!activeSnapshot && session?.roomCode === roomCode) {
      void reconnectRoom(roomCode, session.reconnectToken);
    }
  }, [activeSnapshot, navigate, reconnectRoom, roomCode, session]);

  useEffect(() => {
    if (currentGame?.phase === "bidding") {
      setShowBiddingPanel(true);
    }
  }, [currentGame?.phase]);

  const partnerCards = useMemo(() => {
    if (!me) {
      return [];
    }

    return buildEligiblePartnerCards(players.length || 4, me.hand);
  }, [me, players.length]);

  const handleJoin = async () => {
    clearError();
    const nameError = validateName(joinName);
    if (nameError) {
      setLocalError(nameError);
      return;
    }

    const response = await joinRoom(roomCode, joinName.trim());
    if (!response.ok) {
      setLocalError(response.error.message);
    }
  };

  const handleLeave = async () => {
    const response = await leaveRoom();
    if (response.ok) {
      navigate("/");
    }
  };

  const flashCopy = (message: string) => {
    setCopied(message);
    window.setTimeout(() => setCopied(null), 1600);
  };

  if (expired?.roomCode === roomCode) {
    return (
      <div className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-5">
        <div className="glass w-full rounded-[2rem] border border-white/10 p-8 text-center shadow-glow">
          <Badge tone="rose">Room Expired</Badge>
          <h1 className="mt-4 font-display text-5xl text-white">This table has closed</h1>
          <p className="mt-3 text-slate-300">The room only exists while players remain inside it. Open a fresh table to play again.</p>
          <div className="mt-8 flex justify-center gap-3">
            <Link to="/">
              <Button>Back Home</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!activeSnapshot || !me) {
    return (
      <div className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-5 py-12">
        <div className="glass w-full rounded-[2rem] border border-white/10 p-8 shadow-glow">
          <Link to="/" className="mb-5 inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
          <Badge tone="gold">Join Room</Badge>
          <h1 className="mt-4 font-display text-5xl text-white">Room {roomCode}</h1>
          <p className="mt-3 text-slate-300">Take your seat, reclaim a saved session, or wait while we reconnect you to the table.</p>
          <div className="mt-8 space-y-4">
            <input
              value={joinName}
              onChange={(event) => {
                setJoinName(event.target.value);
                setLocalError(null);
              }}
              placeholder="Your name"
              className="w-full rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3 text-white"
            />
            <div className="flex flex-wrap gap-3">
              <Button onClick={handleJoin} disabled={pending}>
                <Users className="h-4 w-4" />
                Join Table
              </Button>
              <Link to="/">
                <Button variant="ghost">Open New Room</Button>
              </Link>
            </div>
            {visibleError ? <div className="rounded-2xl border border-rose-300/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">{visibleError}</div> : null}
          </div>
        </div>
      </div>
    );
  }

  const knownPartnerIds = [...me.knownPartnerIds, ...(me.role === "partner" ? [me.playerId] : [])];

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-5 sm:px-6 lg:px-8">
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <Badge tone="gold">Room {roomCode}</Badge>
          <Badge tone="slate">{players.length} players</Badge>
          {copied ? <Badge tone="emerald">{copied}</Badge> : null}
        </div>
        <div className="flex flex-wrap gap-3">
          <Button
            variant="ghost"
            onClick={async () => {
              await copyText(buildInviteLink(roomCode));
              flashCopy("Invite link copied");
            }}
          >
            <Clipboard className="h-4 w-4" />
            Copy Invite
          </Button>
          <Button
            variant="ghost"
            onClick={async () => {
              await copyText(roomCode);
              flashCopy("Room code copied");
            }}
          >
            <Clipboard className="h-4 w-4" />
            Copy Code
          </Button>
          <Button variant="danger" onClick={handleLeave}>
            Leave Room
          </Button>
        </div>
      </div>

      {!currentGame ? (
        <LobbyView
          roomCode={roomCode}
          players={players}
          settings={activeSnapshot.room.settings}
          meId={me.playerId}
          isHost={isHost}
          pending={pending}
          onLeave={handleLeave}
          onStart={() => {
            void startGame();
          }}
          onSettingsChange={(field, value) => {
            const payload: UpdateSettingsInput =
              field === "maxPlayers"
                ? { maxPlayers: Number(value) as 4 | 5 | 6 | 7 | 8 }
                : field === "targetScore"
                  ? { targetScore: Number(value) }
                  : field === "rounds"
                    ? { rounds: Number(value) }
                    : { gameMode: value as "target-score" | "rounds" };
            void updateSettings(payload);
          }}
          onAddSmartBot={(count = 1) => {
            void (async () => {
              for (let index = 0; index < count; index += 1) {
                const response = await addSmartBot();
                if (!response.ok) {
                  break;
                }
              }
            })();
          }}
          onRemoveSmartBot={(botPlayerId) => {
            void removeSmartBot(botPlayerId);
          }}
        />
      ) : (
        <TableView
          players={players}
          meId={me.playerId}
          game={currentGame}
          hand={me.hand}
          legalCardIds={me.legalCardIds}
          meRole={me.role}
          secretNotice={me.secretNotice}
          knownPartnerIds={knownPartnerIds}
          notifications={activeSnapshot.room.notifications}
          onPlayCard={(cardId) => {
            void playCard({ cardId });
          }}
        />
      )}

      {currentGame ? (
        <>
          {currentGame.phase === "bidding" ? (
            <BiddingPanel
              visible={showBiddingPanel}
              game={currentGame}
              players={players}
              meId={me.playerId}
              onPass={() => {
                void submitBid({ action: "pass" });
              }}
              onBid={(amount) => {
                void submitBid({ action: "bid", amount });
              }}
              onToggle={() => {
                setShowBiddingPanel((current) => !current);
              }}
            />
          ) : null}
          <PartnerSelectionModal
            open={currentGame.phase === "partner-selection" && currentGame.declarerId === me.playerId}
            cards={partnerCards}
            requiredPartners={players.length >= 6 ? 2 : 1}
            onSubmit={(primaryCardIds, backupCardIds) => {
              void selectPartners({ primaryCardIds, backupCardIds });
            }}
          />
          <TrumpSelectionModal
            open={currentGame.phase === "trump-selection" && currentGame.declarerId === me.playerId}
            onSelect={(suit) => {
              void selectTrump(suit);
            }}
          />
          <SummaryModal
            open={currentGame.phase === "round-summary" || currentGame.phase === "game-over"}
            game={currentGame}
            players={players}
            isHost={isHost}
            onContinue={() => {
              void continueGame();
            }}
            onReturnToLobby={() => {
              void returnToLobby();
            }}
          />
        </>
      ) : null}

      <AnimatePresence>
        {visibleError ? (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            className="fixed bottom-5 right-5 z-50 max-w-md rounded-[1.5rem] border border-rose-300/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100 shadow-glow"
          >
            <div className="flex items-start justify-between gap-4">
              <p>{visibleError}</p>
              <button
                type="button"
                onClick={() => {
                  setLocalError(null);
                  clearError();
                }}
                className="text-rose-200/70"
              >
                <RefreshCcw className="h-4 w-4" />
              </button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
};
