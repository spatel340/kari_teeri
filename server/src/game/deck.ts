import { RANKS, SUITS, createCard } from "@kari-teeri/shared";
import { REMOVED_TWOS_BY_PLAYER_COUNT } from "@kari-teeri/shared";
import type { Card } from "@kari-teeri/shared";

const SUIT_ORDER = ["clubs", "diamonds", "hearts", "spades"] as const;
const RANK_WEIGHT: Record<string, number> = {
  A: 12,
  K: 11,
  Q: 10,
  J: 9,
  "10": 8,
  "9": 7,
  "8": 6,
  "7": 5,
  "6": 4,
  "5": 3,
  "4": 2,
  "3": 1,
  "2": 0
};

export const sortCards = (cards: Card[]): Card[] =>
  [...cards].sort((left, right) => {
    const suitDifference = SUIT_ORDER.indexOf(left.suit) - SUIT_ORDER.indexOf(right.suit);
    if (suitDifference !== 0) {
      return suitDifference;
    }

    return RANK_WEIGHT[right.rank] - RANK_WEIGHT[left.rank];
  });

export const buildDeckForPlayerCount = (playerCount: number): Card[] => {
  const removedCards = new Set(REMOVED_TWOS_BY_PLAYER_COUNT[playerCount] ?? []);

  return SUITS.flatMap((suit) =>
    RANKS.map((rank) => createCard(rank, suit)).filter((card) => !removedCards.has(card.id)),
  );
};

export const shuffleDeck = (cards: Card[]): Card[] => {
  const deck = [...cards];

  for (let index = deck.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [deck[index], deck[swapIndex]] = [deck[swapIndex]!, deck[index]!];
  }

  return deck;
};

export const dealHands = (deck: Card[], playerIds: string[]): Record<string, Card[]> => {
  const hands = Object.fromEntries(playerIds.map((playerId) => [playerId, [] as Card[]])) as Record<string, Card[]>;

  deck.forEach((card, index) => {
    const playerId = playerIds[index % playerIds.length]!;
    hands[playerId]!.push(card);
  });

  Object.keys(hands).forEach((playerId) => {
    hands[playerId] = sortCards(hands[playerId]!);
  });

  return hands;
};
