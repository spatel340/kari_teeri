import { BID_INCREMENT, MAX_BID, MIN_BID, SUITS } from "@kari-teeri/shared";
import type { BidActionInput, Card, CardId, PartnerSelectionInput, Suit, Trick } from "@kari-teeri/shared";
import { determineTrickWinner, getCardPoints, getLegalCardIds } from "./rules.js";
import type { ServerGameState, ServerPlayer } from "../types.js";
import { createError } from "../utils.js";

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
  "2": 0,
};

const getHand = (game: ServerGameState, playerId: string): Card[] => game.hands[playerId] ?? [];

const isKaliTeeri = (card: Card): boolean => card.id === "3S";

const getCardStrength = (card: Card, trumpSuit: Suit, ledSuit: Suit | null): number => {
  if (isKaliTeeri(card)) {
    return 10_000;
  }

  if (card.suit === trumpSuit) {
    return 5_000 + RANK_WEIGHT[card.rank];
  }

  if (ledSuit && card.suit === ledSuit) {
    return 1_000 + RANK_WEIGHT[card.rank];
  }

  return RANK_WEIGHT[card.rank];
};

const getSuitStrength = (cards: Card[], suit: Suit): number =>
  cards
    .filter((card) => card.suit === suit || (suit === "spades" && isKaliTeeri(card)))
    .reduce((total, card) => total + RANK_WEIGHT[card.rank] + getCardPoints(card) * 0.6 + (card.suit === suit ? 2 : 0), 0);

const getStrongestSuit = (cards: Card[]): Suit =>
  [...SUITS].sort((left, right) => getSuitStrength(cards, right) - getSuitStrength(cards, left))[0]!;

const getTeamIds = (game: ServerGameState, playerId: string): Set<string> => {
  const declarerTeam = new Set([game.declarerId, ...(game.partnerSelection?.resolvedPartnerIds ?? [])].filter(Boolean) as string[]);
  if (declarerTeam.has(playerId)) {
    return declarerTeam;
  }

  const allPlayerIds = Object.keys(game.hands);
  return new Set(allPlayerIds.filter((id) => !declarerTeam.has(id)));
};

const getWinningCards = (game: ServerGameState, playerId: string, legalCards: Card[]): Card[] => {
  if (!game.currentTrick || !game.trumpSuit) {
    return [];
  }

  return legalCards.filter((card) => {
    const candidateTrick: Trick = {
      ...game.currentTrick!,
      cards: [...game.currentTrick!.cards, { playerId, card }],
      ledSuit: game.currentTrick!.ledSuit ?? card.suit,
    };

    return determineTrickWinner(candidateTrick, game.trumpSuit!) === playerId;
  });
};

const pickLowestRiskDiscard = (cards: Card[], trumpSuit: Suit): Card =>
  [...cards].sort((left, right) => {
    const leftPenalty = getCardPoints(left) * 20 + (left.suit === trumpSuit ? 10 : 0) + (isKaliTeeri(left) ? 1000 : 0);
    const rightPenalty = getCardPoints(right) * 20 + (right.suit === trumpSuit ? 10 : 0) + (isKaliTeeri(right) ? 1000 : 0);
    return leftPenalty - rightPenalty || RANK_WEIGHT[left.rank] - RANK_WEIGHT[right.rank];
  })[0]!;

const pickCheapestWinningCard = (cards: Card[], trumpSuit: Suit, ledSuit: Suit | null): Card =>
  [...cards].sort(
    (left, right) =>
      getCardStrength(left, trumpSuit, ledSuit) - getCardStrength(right, trumpSuit, ledSuit) ||
      getCardPoints(left) - getCardPoints(right),
  )[0]!;

const pickLeadCard = (hand: Card[], trumpSuit: Suit): Card => {
  const strongestSuit = getStrongestSuit(hand);
  const candidates = hand.filter((card) => card.suit === strongestSuit && !isKaliTeeri(card));
  const pool = candidates.length > 0 ? candidates : hand;

  return [...pool].sort((left, right) => {
    const scoreDelta = getCardStrength(right, trumpSuit, strongestSuit) - getCardStrength(left, trumpSuit, strongestSuit);
    if (scoreDelta !== 0) {
      return scoreDelta;
    }

    return getCardPoints(right) - getCardPoints(left);
  })[0]!;
};

export const chooseSmartBotBid = (game: ServerGameState, playerId: string): BidActionInput => {
  if (!game.bidState) {
    throw createError("INVALID_ACTION", "The auction is not active.");
  }

  const hand = getHand(game, playerId);
  const bestSuit = getStrongestSuit(hand);
  const bestSuitStrength = getSuitStrength(hand, bestSuit);
  const rawStrength =
    hand.reduce((total, card) => total + getCardPoints(card) * 0.8 + RANK_WEIGHT[card.rank] * 1.4, 0) +
    bestSuitStrength * 2.1 +
    hand.filter((card) => card.suit === bestSuit).length * 6 +
    (hand.some(isKaliTeeri) ? 18 : 0);
  const maxBid = Math.max(MIN_BID - BID_INCREMENT, Math.min(MAX_BID, Math.floor((135 + rawStrength) / BID_INCREMENT) * BID_INCREMENT));
  const currentBid = game.bidState.currentBid;
  if (currentBid !== null && (currentBid >= MAX_BID || maxBid <= currentBid)) {
    return { action: "pass" };
  }

  const nextBid = currentBid === null ? MIN_BID : currentBid + (currentBid + 10 <= maxBid ? 10 : BID_INCREMENT);

  if (maxBid < MIN_BID || nextBid > maxBid) {
    return { action: "pass" };
  }

  return { action: "bid", amount: nextBid };
};

export const chooseSmartBotPartners = (game: ServerGameState, playerId: string): PartnerSelectionInput => {
  const handIds = new Set(getHand(game, playerId).map((card) => card.id));
  const eligibleCards = [...game.activeDeck]
    .filter((card) => !handIds.has(card.id))
    .sort((left, right) => {
      const pointDelta = getCardPoints(right) - getCardPoints(left);
      if (pointDelta !== 0) {
        return pointDelta;
      }

      return getSuitStrength([right], right.suit) - getSuitStrength([left], left.suit);
    });

  const requiredPartners = game.partnerSelection?.requiredPartners ?? (Object.keys(game.hands).length >= 6 ? 2 : 1);
  if (requiredPartners === 1) {
    return {
      primaryCardIds: [eligibleCards[0]!.id],
      backupCardIds: [],
    };
  }

  return {
    primaryCardIds: eligibleCards.slice(0, 2).map((card) => card.id),
    backupCardIds: eligibleCards.slice(2, 4).map((card) => card.id),
  };
};

export const chooseSmartBotTrump = (game: ServerGameState, playerId: string): Suit => getStrongestSuit(getHand(game, playerId));

export const chooseSmartBotCard = (game: ServerGameState, players: ServerPlayer[], playerId: string): CardId => {
  if (!game.trumpSuit || game.phase !== "trick-play") {
    throw createError("INVALID_ACTION", "It is not time to play a trick.");
  }

  const hand = getHand(game, playerId);
  const trick = game.currentTrick;
  const legalCards = hand.filter((card) => getLegalCardIds(hand, trick).includes(card.id));
  if (legalCards.length === 0) {
    throw createError("ILLEGAL_MOVE", "The bot has no legal card to play.");
  }

  if (!trick || trick.cards.length === 0) {
    return pickLeadCard(legalCards, game.trumpSuit).id;
  }

  const teamIds = getTeamIds(game, playerId);
  const currentWinnerId = determineTrickWinner(trick, game.trumpSuit);
  const teamAlreadyWinning = teamIds.has(currentWinnerId);
  const trickPoints = trick.cards.reduce((total, entry) => total + getCardPoints(entry.card), 0);
  const winningCards = getWinningCards(game, playerId, legalCards);

  if (winningCards.length > 0 && (!teamAlreadyWinning || trickPoints >= 10 || trick.cards.length === players.length - 1)) {
    return pickCheapestWinningCard(winningCards, game.trumpSuit, trick.ledSuit).id;
  }

  return pickLowestRiskDiscard(legalCards, game.trumpSuit).id;
};
