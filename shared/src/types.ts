export type Suit = "clubs" | "diamonds" | "hearts" | "spades";
export type Rank = "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "J" | "Q" | "K" | "A";
export type CardId = string;

export interface Card {
  id: CardId;
  rank: Rank;
  suit: Suit;
  label: string;
}

export interface Player {
  id: string;
  name: string;
  seatIndex: number;
  isHost: boolean;
  isBot: boolean;
  isConnected: boolean;
  avatarHue: number;
  joinedAt: number;
}

export type GamePhase =
  | "lobby"
  | "dealing"
  | "bidding"
  | "partner-selection"
  | "trump-selection"
  | "trick-play"
  | "round-summary"
  | "game-over";

export type GameMode = "target-score" | "rounds";
export type PlayerRole = "declarer" | "partner" | "opponent" | "unassigned";
export type RoomStatus = "active" | "expired";
export type NotificationTone = "neutral" | "success" | "warning";

export interface RoomSettings {
  maxPlayers: 4 | 5 | 6 | 7 | 8;
  gameMode: GameMode;
  targetScore: number;
  rounds: number;
}

export interface RoomNotification {
  id: string;
  message: string;
  tone: NotificationTone;
  timestamp: number;
}

export interface BidHistoryEntry {
  id: string;
  playerId: string;
  type: "bid" | "pass";
  amount?: number;
  timestamp: number;
}

export interface BidState {
  currentBid: number | null;
  highestBidderId: string | null;
  activePlayerId: string | null;
  passedPlayerIds: string[];
  order: string[];
  history: BidHistoryEntry[];
}

export interface TrickCard {
  playerId: string;
  card: Card;
}

export interface Trick {
  leaderId: string;
  ledSuit: Suit | null;
  winnerId: string | null;
  trickNumber: number;
  collectedPoints: number;
  cards: TrickCard[];
}

export interface CalledPartnerState {
  requiredPartners: 1 | 2;
  primaryCardIds: CardId[];
  backupCardIds: CardId[];
  revealedPartnerIds: string[];
}

export interface HandSummary {
  handNumber: number;
  dealerId: string;
  declarerId: string;
  bid: number;
  trumpSuit: Suit;
  calledPartners: CalledPartnerState;
  actualPartnerIds: string[];
  declarerTeamIds: string[];
  opponentIds: string[];
  declarerTeamPoints: number;
  opponentPoints: number;
  bidSucceeded: boolean;
  scoreAwarded: {
    declarerTeam: number;
    opponents: number;
  };
  totals: Record<string, number>;
}

export interface ScoreState {
  totals: Record<string, number>;
  history: HandSummary[];
  lastSummary: HandSummary | null;
}

export interface PublicGameState {
  phase: GamePhase;
  handNumber: number;
  dealerId: string | null;
  turnPlayerId: string | null;
  declarerId: string | null;
  trumpSuit: Suit | null;
  bidState: BidState | null;
  currentTrick: Trick | null;
  completedTrickCount: number;
  cardsPerPlayer: number;
  calledPartners: CalledPartnerState | null;
  partnerCount: 1 | 2;
  revealedPartnerIds: string[];
  score: ScoreState;
  lastTrickWinnerId: string | null;
  statusText: string;
  winningPlayerIds: string[];
}

export interface PrivatePlayerState {
  playerId: string;
  hand: Card[];
  legalCardIds: CardId[];
  role: PlayerRole;
  secretNotice: string | null;
  knownPartnerIds: string[];
  knownOpponentIds: string[];
  reconnectToken: string;
}

export interface PublicRoomState {
  code: string;
  players: Player[];
  settings: RoomSettings;
  notifications: RoomNotification[];
  game: PublicGameState | null;
  exists: boolean;
  roomStatus: RoomStatus;
  minPlayers: number;
  maxPlayers: number;
  createdAt: number;
}

export interface RoomSnapshot {
  room: PublicRoomState;
  me: PrivatePlayerState | null;
}

export interface AppError {
  code:
    | "INVALID_NAME"
    | "INVALID_ROOM"
    | "ROOM_FULL"
    | "ROOM_EXPIRED"
    | "DUPLICATE_NAME"
    | "UNAUTHORIZED"
    | "INVALID_ACTION"
    | "NOT_ENOUGH_PLAYERS"
    | "INVALID_SETTINGS"
    | "ILLEGAL_MOVE"
    | "PARTNER_SELECTION_INVALID"
    | "BID_INVALID";
  message: string;
}

export interface AckSuccess<T> {
  ok: true;
  data: T;
}

export interface AckFailure {
  ok: false;
  error: AppError;
}

export type AckResponse<T> = AckSuccess<T> | AckFailure;
export type AckCallback<T> = (response: AckResponse<T>) => void;

export interface CreateRoomInput {
  name: string;
  token?: string | null;
}

export interface JoinRoomInput {
  roomCode: string;
  name: string;
  token?: string | null;
}

export interface ReconnectRoomInput {
  roomCode: string;
  token: string;
}

export interface JoinRoomResult {
  roomCode: string;
  playerId: string;
  reconnectToken: string;
}

export interface UpdateSettingsInput {
  maxPlayers?: 4 | 5 | 6 | 7 | 8;
  gameMode?: GameMode;
  targetScore?: number;
  rounds?: number;
}

export interface RemoveSmartBotInput {
  botPlayerId?: string;
}

export interface BidActionInput {
  action: "pass" | "bid";
  amount?: number;
}

export interface TrumpSelectionInput {
  suit: Suit;
}

export interface PartnerSelectionInput {
  primaryCardIds: CardId[];
  backupCardIds: CardId[];
}

export interface PlayCardInput {
  cardId: CardId;
}

export interface RoomExpiredEvent {
  roomCode: string;
  message: string;
}

export interface ServerToClientEvents {
  "room:state": (snapshot: RoomSnapshot) => void;
  "room:expired": (payload: RoomExpiredEvent) => void;
  "room:error": (error: AppError) => void;
}

export interface ClientToServerEvents {
  "room:create": (payload: CreateRoomInput, callback: AckCallback<JoinRoomResult>) => void;
  "room:join": (payload: JoinRoomInput, callback: AckCallback<JoinRoomResult>) => void;
  "room:reconnect": (payload: ReconnectRoomInput, callback: AckCallback<JoinRoomResult>) => void;
  "room:leave": (callback?: AckCallback<undefined>) => void;
  "room:update-settings": (payload: UpdateSettingsInput, callback?: AckCallback<undefined>) => void;
  "room:add-smart-bot": (callback?: AckCallback<undefined>) => void;
  "room:remove-smart-bot": (payload: RemoveSmartBotInput, callback?: AckCallback<undefined>) => void;
  "game:start": (callback?: AckCallback<undefined>) => void;
  "game:bid": (payload: BidActionInput, callback?: AckCallback<undefined>) => void;
  "game:select-trump": (payload: TrumpSelectionInput, callback?: AckCallback<undefined>) => void;
  "game:select-partners": (payload: PartnerSelectionInput, callback?: AckCallback<undefined>) => void;
  "game:play-card": (payload: PlayCardInput, callback?: AckCallback<undefined>) => void;
  "game:continue": (callback?: AckCallback<undefined>) => void;
  "game:return-to-lobby": (callback?: AckCallback<undefined>) => void;
}
