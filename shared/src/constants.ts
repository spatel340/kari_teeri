export const SUITS = ["clubs", "diamonds", "hearts", "spades"] as const;
export const RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"] as const;

export const SUIT_SYMBOLS = {
  clubs: "♣",
  diamonds: "♦",
  hearts: "♥",
  spades: "♠",
} as const;

export const SUIT_SHORT = {
  clubs: "C",
  diamonds: "D",
  hearts: "H",
  spades: "S",
} as const;

export const ROOM_CODE_LENGTH = 6;
export const MIN_PLAYERS = 4;
export const MAX_PLAYERS = 8;
export const DEFAULT_TARGET_SCORE = 1000;
export const DEFAULT_ROUNDS = 5;
export const MIN_BID = 150;
export const MAX_BID = 250;
export const BID_INCREMENT = 5;
export const TOTAL_HAND_POINTS = 250;
export const PLAYER_OPTIONS = [4, 5, 6, 7, 8] as const;

export const REMOVED_TWOS_BY_PLAYER_COUNT: Record<number, string[]> = {
  4: [],
  5: ["2C", "2D"],
  6: ["2C", "2D", "2H", "2S"],
  7: ["2C", "2D", "2H"],
  8: ["2C", "2D", "2H", "2S"],
};

export const STATUS_COPY = {
  lobby: "Gather your table, tune the stakes, and begin when everyone is seated.",
  dealing: "The dealer shuffles the pack and lays out the next hand.",
  bidding: "Bids climb in fives. Pass to bow out, or press the table harder.",
  "partner-selection": "The declarer secretly calls the partner card pattern.",
  "trump-selection": "Choose the sir that will shape the hand.",
  "trick-play": "Follow suit when you can. Kali Teeri can change everything.",
  "round-summary": "The hand is scored and the table settles the wager.",
  "game-over": "The session crowns a winner and waits for the next showdown.",
} as const;
