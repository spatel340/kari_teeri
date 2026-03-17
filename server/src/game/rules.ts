import { MAX_BID, MIN_BID, TOTAL_HAND_POINTS } from "@kari-teeri/shared";
import type { Card, CardId, Suit, Trick } from "@kari-teeri/shared";

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

export const isKaliTeeri = (card: Card): boolean => card.id === "3S";

export const getCardPoints = (card: Card): number => {
  if (card.id === "3S") {
    return 30;
  }

  if (["A", "K", "Q", "J", "10"].includes(card.rank)) {
    return 10;
  }

  if (card.rank === "5") {
    return 5;
  }

  return 0;
};

export const getTrickPoints = (cards: Card[]): number => cards.reduce((sum, card) => sum + getCardPoints(card), 0);

export const getLegalCardIds = (hand: Card[], trick: Trick | null): CardId[] => {
  if (!trick || trick.cards.length === 0) {
    return hand.map((card) => card.id);
  }

  if (!trick.ledSuit) {
    return hand.map((card) => card.id);
  }

  const followSuitCards = hand.filter((card) => card.suit === trick.ledSuit);
  if (followSuitCards.length > 0) {
    return followSuitCards.map((card) => card.id);
  }

  return hand.map((card) => card.id);
};

const highestRankCard = (cards: Card[]): Card => {
  const sorted = [...cards].sort((left, right) => RANK_WEIGHT[right.rank] - RANK_WEIGHT[left.rank]);
  return sorted[0]!;
};

export const determineTrickWinner = (trick: Trick, trumpSuit: Suit): string => {
  const kaliTeeriEntry = trick.cards.find((entry) => isKaliTeeri(entry.card));
  if (kaliTeeriEntry) {
    return kaliTeeriEntry.playerId;
  }

  const trumpCards = trick.cards.filter((entry) => entry.card.suit === trumpSuit);
  if (trumpCards.length > 0) {
    const winningCard = highestRankCard(trumpCards.map((entry) => entry.card));
    return trumpCards.find((entry) => entry.card.id === winningCard.id)!.playerId;
  }

  const ledCards = trick.cards.filter((entry) => entry.card.suit === trick.ledSuit);
  const winningCard = highestRankCard(ledCards.map((entry) => entry.card));
  return ledCards.find((entry) => entry.card.id === winningCard.id)!.playerId;
};

export const isValidBidAmount = (amount: number, currentBid: number | null): boolean => {
  if (amount < MIN_BID || amount > MAX_BID) {
    return false;
  }

  if (amount % 5 !== 0) {
    return false;
  }

  if (currentBid === null) {
    return amount >= MIN_BID;
  }

  return amount >= currentBid + 5;
};

export const calculateOpponentPoints = (declarerTeamPoints: number): number => TOTAL_HAND_POINTS - declarerTeamPoints;
