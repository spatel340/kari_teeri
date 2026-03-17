import type { BidState, CalledPartnerState, GamePhase, HandSummary, Player, RoomNotification, RoomSettings, ScoreState, Suit, Trick } from "@kari-teeri/shared";
import type { Card } from "@kari-teeri/shared";

export interface ServerPlayer extends Player {
  token: string;
  socketId: string | null;
  disconnectedAt: number | null;
}

export interface InternalBidState extends BidState {
  activePlayerIds: string[];
}

export interface InternalPartnerSelection extends CalledPartnerState {
  resolvedPartnerIds: string[];
  resolvedCardIdsByPlayerId: Record<string, string>;
  hiddenFallbackCardIds: string[];
  holderByCardId: Record<string, string>;
}

export interface ServerGameState {
  phase: GamePhase;
  handNumber: number;
  dealerIndex: number;
  hands: Record<string, Card[]>;
  activeDeck: Card[];
  bidState: InternalBidState | null;
  declarerId: string | null;
  trumpSuit: Suit | null;
  partnerSelection: InternalPartnerSelection | null;
  turnPlayerId: string | null;
  currentTrick: Trick | null;
  completedTricks: Trick[];
  score: ScoreState;
  lastTrickWinnerId: string | null;
  cardsPerPlayer: number;
  winningPlayerIds: string[];
}

export interface RoomSession {
  code: string;
  createdAt: number;
  players: ServerPlayer[];
  settings: RoomSettings;
  notifications: RoomNotification[];
  game: ServerGameState | null;
}

export interface BidOutcome {
  kind: "pending" | "all-pass" | "declarer-selected";
  declarerId?: string;
}

export interface PlayOutcome {
  trickCompleted: boolean;
  handCompleted: boolean;
  summary?: HandSummary;
  winnerId?: string;
}
