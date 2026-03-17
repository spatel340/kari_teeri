import { SUIT_SHORT, SUIT_SYMBOLS } from "./constants";
import type { Card, CardId, Rank, Suit } from "./types";

const SYMBOL_BY_CODE = {
  C: SUIT_SYMBOLS.clubs,
  D: SUIT_SYMBOLS.diamonds,
  H: SUIT_SYMBOLS.hearts,
  S: SUIT_SYMBOLS.spades,
} as const;

export const createCardId = (rank: Rank, suit: Suit): CardId => `${rank}${SUIT_SHORT[suit]}`;

export const createCard = (rank: Rank, suit: Suit): Card => ({
  id: createCardId(rank, suit),
  rank,
  suit,
  label: `${rank}${SUIT_SYMBOLS[suit]}`,
});

export const formatCardId = (cardId: CardId): string => {
  const suitCode = cardId.slice(-1) as keyof typeof SYMBOL_BY_CODE;
  const rank = cardId.slice(0, -1);

  return `${rank}${SYMBOL_BY_CODE[suitCode] ?? ""}`;
};

export const getSuitLabel = (suit: Suit): string => `${suit[0]!.toUpperCase()}${suit.slice(1)}`;
