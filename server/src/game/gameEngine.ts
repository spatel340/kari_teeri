import { MIN_BID, STATUS_COPY } from "@kari-teeri/shared";
import type { CardId, HandSummary, PlayerRole, RoomSettings, Suit, Trick } from "@kari-teeri/shared";
import { buildDeckForPlayerCount, dealHands, shuffleDeck, sortCards } from "./deck.js";
import { calculateOpponentPoints, determineTrickWinner, getLegalCardIds, getTrickPoints, isValidBidAmount } from "./rules.js";
import { resolveHandScore } from "./scoring.js";
import type { BidOutcome, InternalBidState, PlayOutcome, ServerGameState, ServerPlayer } from "../types.js";
import { createError, now } from "../utils.js";

const createScoreTotals = (players: ServerPlayer[], existing: Record<string, number> = {}): Record<string, number> =>
  Object.fromEntries(players.map((player) => [player.id, existing[player.id] ?? 0]));

const orderedPlayers = (players: ServerPlayer[]): ServerPlayer[] =>
  [...players].sort((left, right) => left.seatIndex - right.seatIndex);

const getPlayerIdsClockwise = (players: ServerPlayer[]): string[] => orderedPlayers(players).map((player) => player.id);

const getDealerId = (game: ServerGameState, players: ServerPlayer[]): string => orderedPlayers(players)[game.dealerIndex]!.id;

const getLeftOfDealerId = (dealerIndex: number, orderedIds: string[]): string => orderedIds[(dealerIndex + 1) % orderedIds.length]!;

const getNextClockwiseId = (orderedIds: string[], playerId: string): string =>
  orderedIds[(orderedIds.indexOf(playerId) + 1) % orderedIds.length]!;

const createEmptyTrick = (leaderId: string, trickNumber: number): Trick => ({
  leaderId,
  ledSuit: null,
  winnerId: null,
  trickNumber,
  collectedPoints: 0,
  cards: [],
});

const getRequiredPartnerCount = (playerCount: number): 1 | 2 => (playerCount >= 6 ? 2 : 1);

const getTopScoringPlayerIds = (totals: Record<string, number>): string[] => {
  const highestScore = Math.max(...Object.values(totals));
  return Object.entries(totals)
    .filter(([, total]) => total === highestScore)
    .map(([playerId]) => playerId);
};

const buildFallbackPartnerCards = (game: ServerGameState, declarerId: string, excludedCardIds: CardId[]): CardId[] => {
  const declarerHandIds = new Set((game.hands[declarerId] ?? []).map((card) => card.id));
  const excludedIds = new Set(excludedCardIds);

  return sortCards(game.activeDeck)
    .filter((card) => !declarerHandIds.has(card.id) && !excludedIds.has(card.id))
    .map((card) => card.id);
};

const resolvePartnersFromCardOrder = (
  game: ServerGameState,
  declarerId: string,
  cardOrder: CardId[],
  requiredPartners: 1 | 2,
) => {
  const resolvedPartnerIds: string[] = [];
  const resolvedCardIdsByPlayerId: Record<string, CardId> = {};
  const holderByCardId = Object.fromEntries(cardOrder.map((cardId) => [cardId, findCardHolder(game.hands, cardId)]));

  cardOrder.forEach((cardId) => {
    const holderId = holderByCardId[cardId];
    if (!holderId || holderId === declarerId || resolvedPartnerIds.includes(holderId)) {
      return;
    }

    if (resolvedPartnerIds.length < requiredPartners) {
      resolvedPartnerIds.push(holderId);
      resolvedCardIdsByPlayerId[holderId] = cardId;
    }
  });

  return {
    resolvedPartnerIds,
    resolvedCardIdsByPlayerId,
    holderByCardId: holderByCardId as Record<string, string>,
  };
};

const resolveNextBidder = (bidState: InternalBidState, currentActorId: string): string | null => {
  const activeIds = bidState.order.filter((playerId) => !bidState.passedPlayerIds.includes(playerId));

  if (bidState.currentBid === null) {
    if (activeIds.length === 0) {
      return null;
    }

    let candidate = currentActorId;
    for (let offset = 0; offset < bidState.order.length; offset += 1) {
      candidate = bidState.order[(bidState.order.indexOf(candidate) + 1) % bidState.order.length]!;
      if (!bidState.passedPlayerIds.includes(candidate)) {
        return candidate;
      }
    }

    return null;
  }

  if (activeIds.length <= 1) {
    return null;
  }

  let candidate = currentActorId;
  for (let offset = 0; offset < bidState.order.length; offset += 1) {
    candidate = bidState.order[(bidState.order.indexOf(candidate) + 1) % bidState.order.length]!;
    if (bidState.passedPlayerIds.includes(candidate)) {
      continue;
    }

    if (candidate === bidState.highestBidderId) {
      continue;
    }

    return candidate;
  }

  return null;
};

const buildHandSummary = (game: ServerGameState, players: ServerPlayer[], settings: RoomSettings): HandSummary => {
  const declarerTeamIds = [game.declarerId!, ...(game.partnerSelection?.resolvedPartnerIds ?? [])];
  const opponentIds = players.map((player) => player.id).filter((playerId) => !declarerTeamIds.includes(playerId));

  const declarerTeamPoints = game.completedTricks
    .filter((trick) => trick.winnerId && declarerTeamIds.includes(trick.winnerId))
    .reduce((sum, trick) => sum + trick.collectedPoints, 0);

  const scoreResult = resolveHandScore(game.bidState?.currentBid ?? MIN_BID, declarerTeamPoints);
  const totals = { ...game.score.totals };

  declarerTeamIds.forEach((playerId) => {
    totals[playerId] = (totals[playerId] ?? 0) + scoreResult.declarerAward;
  });

  opponentIds.forEach((playerId) => {
    totals[playerId] = (totals[playerId] ?? 0) + scoreResult.opponentAward;
  });

  const summary: HandSummary = {
    handNumber: game.handNumber,
    dealerId: getDealerId(game, players),
    declarerId: game.declarerId!,
    bid: game.bidState?.currentBid ?? MIN_BID,
    trumpSuit: game.trumpSuit!,
    calledPartners: {
      requiredPartners: game.partnerSelection!.requiredPartners,
      primaryCardIds: [...game.partnerSelection!.primaryCardIds],
      backupCardIds: [...game.partnerSelection!.backupCardIds],
      revealedPartnerIds: [...game.partnerSelection!.revealedPartnerIds],
    },
    actualPartnerIds: [...game.partnerSelection!.resolvedPartnerIds],
    declarerTeamIds,
    opponentIds,
    declarerTeamPoints,
    opponentPoints: calculateOpponentPoints(declarerTeamPoints),
    bidSucceeded: scoreResult.bidSucceeded,
    scoreAwarded: {
      declarerTeam: scoreResult.declarerAward,
      opponents: scoreResult.opponentAward,
    },
    totals,
  };

  game.score.totals = totals;
  game.score.lastSummary = summary;
  game.score.history = [...game.score.history, summary];
  game.winningPlayerIds = [];

  if (settings.gameMode === "target-score") {
    const highestScore = Math.max(...Object.values(totals));
    const topScorers = getTopScoringPlayerIds(totals);
    if (highestScore >= settings.targetScore && topScorers.length === 1) {
      game.phase = "game-over";
      game.winningPlayerIds = topScorers;
      return summary;
    }
  }

  if (settings.gameMode === "rounds" && game.score.history.length >= settings.rounds) {
    const topScorers = getTopScoringPlayerIds(totals);
    if (topScorers.length === 1) {
      game.phase = "game-over";
      game.winningPlayerIds = topScorers;
      return summary;
    }
  }

  game.phase = "round-summary";
  return summary;
};

const findCardHolder = (hands: Record<string, { id: CardId }[]>, cardId: CardId): string | null => {
  const holder = Object.entries(hands).find(([, hand]) => hand.some((card) => card.id === cardId));
  return holder?.[0] ?? null;
};

const maybeRevealPartner = (game: ServerGameState, playerId: string, cardId: CardId): void => {
  if (!game.partnerSelection) {
    return;
  }

  const identifyingCardId = game.partnerSelection.resolvedCardIdsByPlayerId[playerId];
  if (identifyingCardId === cardId && game.partnerSelection.resolvedPartnerIds.includes(playerId)) {
    if (!game.partnerSelection.revealedPartnerIds.includes(playerId)) {
      game.partnerSelection.revealedPartnerIds.push(playerId);
    }
  }
};

const ensureCurrentTrick = (game: ServerGameState): Trick => {
  const playerCount = Object.keys(game.hands).length;
  if (!game.currentTrick || game.currentTrick.cards.length === playerCount) {
    game.currentTrick = createEmptyTrick(game.turnPlayerId!, game.completedTricks.length + 1);
  }

  return game.currentTrick;
};

export const createMatch = (players: ServerPlayer[]): ServerGameState => ({
  phase: "dealing",
  handNumber: 0,
  dealerIndex: 0,
  hands: {},
  activeDeck: [],
  bidState: null,
  declarerId: null,
  trumpSuit: null,
  partnerSelection: null,
  turnPlayerId: null,
  currentTrick: null,
  completedTricks: [],
  score: {
    totals: createScoreTotals(players),
    history: [],
    lastSummary: null,
  },
  lastTrickWinnerId: null,
  cardsPerPlayer: 0,
  winningPlayerIds: [],
});

export const prepareHand = (
  game: ServerGameState,
  players: ServerPlayer[],
  options?: { sameDealer?: boolean; redeal?: boolean },
): void => {
  const clockwisePlayers = orderedPlayers(players);

  if (!options?.sameDealer && game.handNumber > 0) {
    game.dealerIndex = (game.dealerIndex + 1) % clockwisePlayers.length;
  }

  const deck = shuffleDeck(buildDeckForPlayerCount(players.length));
  const playerIds = clockwisePlayers.map((player) => player.id);

  if (!options?.redeal) {
    game.handNumber += 1;
  }
  game.phase = "dealing";
  game.activeDeck = deck;
  game.hands = dealHands(deck, playerIds);
  game.bidState = null;
  game.declarerId = null;
  game.trumpSuit = null;
  game.partnerSelection = null;
  game.turnPlayerId = null;
  game.currentTrick = null;
  game.completedTricks = [];
  game.lastTrickWinnerId = null;
  game.cardsPerPlayer = deck.length / players.length;
  game.winningPlayerIds = [];
  game.score.totals = createScoreTotals(players, game.score.totals);
};

export const beginBidding = (game: ServerGameState, players: ServerPlayer[]): void => {
  const playerIds = getPlayerIdsClockwise(players);
  const startingPlayerId = getLeftOfDealerId(game.dealerIndex, playerIds);

  game.phase = "bidding";
  game.bidState = {
    currentBid: null,
    highestBidderId: null,
    activePlayerId: startingPlayerId,
    passedPlayerIds: [],
    order: playerIds,
    history: [],
    activePlayerIds: [...playerIds],
  };
  game.turnPlayerId = startingPlayerId;
};

export const submitBid = (
  game: ServerGameState,
  playerId: string,
  input: { action: "pass" | "bid"; amount?: number },
): BidOutcome => {
  const bidState = game.bidState;

  if (game.phase !== "bidding" || !bidState) {
    throw createError("INVALID_ACTION", "The auction is not active right now.");
  }

  if (bidState.activePlayerId !== playerId) {
    throw createError("INVALID_ACTION", "It is not your turn to bid.");
  }

  if (input.action === "bid") {
    if (typeof input.amount !== "number" || !isValidBidAmount(input.amount, bidState.currentBid)) {
      throw createError("BID_INVALID", "Bids must start at 150, rise in steps of 5, and stop at 250.");
    }

    bidState.currentBid = input.amount;
    bidState.highestBidderId = playerId;
    bidState.history.push({
      id: `${playerId}-${now()}`,
      playerId,
      type: "bid",
      amount: input.amount,
      timestamp: now(),
    });
  } else {
    if (!bidState.passedPlayerIds.includes(playerId)) {
      bidState.passedPlayerIds.push(playerId);
    }

    bidState.activePlayerIds = bidState.activePlayerIds.filter((id) => id !== playerId);
    bidState.history.push({
      id: `${playerId}-${now()}`,
      playerId,
      type: "pass",
      timestamp: now(),
    });
  }

  if (bidState.currentBid === null && bidState.activePlayerIds.length === 0) {
    return { kind: "all-pass" };
  }

  const nextBidder = resolveNextBidder(bidState, playerId);
  bidState.activePlayerId = nextBidder;
  game.turnPlayerId = nextBidder;

  const remaining = bidState.order.filter((id) => !bidState.passedPlayerIds.includes(id));
  if (bidState.currentBid !== null && remaining.length === 1 && bidState.highestBidderId) {
    game.declarerId = bidState.highestBidderId;
    game.phase = "partner-selection";
    game.turnPlayerId = game.declarerId;
    return {
      kind: "declarer-selected",
      declarerId: game.declarerId,
    };
  }

  return { kind: "pending" };
};

export const selectPartners = (
  game: ServerGameState,
  players: ServerPlayer[],
  playerId: string,
  selection: { primaryCardIds: CardId[]; backupCardIds: CardId[] },
): void => {
  if (game.phase !== "partner-selection" || game.declarerId !== playerId) {
    throw createError("INVALID_ACTION", "Only the declarer can call partners right now.");
  }

  const requiredPartners = getRequiredPartnerCount(players.length);
  const expectedPrimary = requiredPartners === 1 ? 1 : 2;
  const expectedBackup = requiredPartners === 1 ? 0 : 2;
  const declarerHand = game.hands[playerId] ?? [];
  const chosen = [...selection.primaryCardIds, ...selection.backupCardIds];

  if (selection.primaryCardIds.length !== expectedPrimary || selection.backupCardIds.length !== expectedBackup) {
    throw createError("PARTNER_SELECTION_INVALID", "Choose the full required set of called cards first.");
  }

  if (new Set(chosen).size !== chosen.length) {
    throw createError("PARTNER_SELECTION_INVALID", "All called cards must be distinct.");
  }

  const invalidChoice = chosen.find(
    (cardId) => !game.activeDeck.some((card) => card.id === cardId) || declarerHand.some((card) => card.id === cardId),
  );

  if (invalidChoice) {
    throw createError("PARTNER_SELECTION_INVALID", "One of those called cards is not eligible for this hand.");
  }

  const hiddenFallbackCardIds = requiredPartners === 2 ? buildFallbackPartnerCards(game, playerId, chosen) : [];
  const resolutionOrder = [...selection.primaryCardIds, ...selection.backupCardIds, ...hiddenFallbackCardIds];
  const { resolvedPartnerIds, resolvedCardIdsByPlayerId, holderByCardId } = resolvePartnersFromCardOrder(
    game,
    playerId,
    resolutionOrder,
    requiredPartners,
  );

  if (resolvedPartnerIds.length !== requiredPartners) {
    throw createError(
      "PARTNER_SELECTION_INVALID",
      "The table could not resolve enough distinct partners from the available fallback chain.",
    );
  }

  game.partnerSelection = {
    requiredPartners,
    primaryCardIds: [...selection.primaryCardIds],
    backupCardIds: [...selection.backupCardIds],
    revealedPartnerIds: [],
    resolvedPartnerIds,
    resolvedCardIdsByPlayerId,
    hiddenFallbackCardIds,
    holderByCardId,
  };
  game.phase = "trump-selection";
  game.turnPlayerId = playerId;
};

export const selectTrump = (game: ServerGameState, players: ServerPlayer[], playerId: string, suit: Suit): void => {
  if (game.phase !== "trump-selection" || game.declarerId !== playerId) {
    throw createError("INVALID_ACTION", "Only the declarer can choose trump right now.");
  }

  const playerIds = getPlayerIdsClockwise(players);
  const leaderId = getLeftOfDealerId(game.dealerIndex, playerIds);

  game.trumpSuit = suit;
  game.phase = "trick-play";
  game.turnPlayerId = leaderId;
  game.currentTrick = createEmptyTrick(leaderId, 1);
};

export const getPrivateRole = (game: ServerGameState | null, playerId: string): PlayerRole => {
  if (!game || !game.declarerId) {
    return "unassigned";
  }

  if (game.declarerId === playerId) {
    return "declarer";
  }

  if (game.partnerSelection?.resolvedPartnerIds.includes(playerId)) {
    return "partner";
  }

  if (game.partnerSelection) {
    return "opponent";
  }

  return "unassigned";
};

export const getKnownPartnerIds = (game: ServerGameState | null, playerId: string): string[] => {
  if (!game || !game.declarerId || !game.partnerSelection) {
    return [];
  }

  if (game.partnerSelection.resolvedPartnerIds.includes(playerId)) {
    return [game.declarerId, ...game.partnerSelection.revealedPartnerIds.filter((id) => id !== playerId)];
  }

  return [...game.partnerSelection.revealedPartnerIds];
};

export const getKnownOpponentIds = (game: ServerGameState | null, playerId: string, players: ServerPlayer[]): string[] => {
  if (!game || !game.declarerId || !game.partnerSelection) {
    return [];
  }

  if (game.partnerSelection.requiredPartners === 1 && game.partnerSelection.resolvedPartnerIds.includes(playerId)) {
    return players.map((player) => player.id).filter((id) => id !== playerId && id !== game.declarerId);
  }

  return [];
};

export const getSecretNotice = (game: ServerGameState | null, playerId: string, players: ServerPlayer[]): string | null => {
  if (!game || !game.declarerId || !game.partnerSelection) {
    return null;
  }

  if (["round-summary", "game-over"].includes(game.phase)) {
    return null;
  }

  if (!game.partnerSelection.resolvedPartnerIds.includes(playerId)) {
    return null;
  }

  const declarerName = players.find((player) => player.id === game.declarerId)?.name ?? "the declarer";
  return `Secret ally: you are partnered with ${declarerName} this hand.`;
};

export const getLegalCardsForPlayer = (game: ServerGameState | null, playerId: string): CardId[] => {
  if (!game || game.phase !== "trick-play" || game.turnPlayerId !== playerId) {
    return [];
  }

  const trick = game.currentTrick && game.currentTrick.cards.length < Object.keys(game.hands).length ? game.currentTrick : null;
  return getLegalCardIds(game.hands[playerId] ?? [], trick);
};

export const playCard = (
  game: ServerGameState,
  players: ServerPlayer[],
  playerId: string,
  cardId: CardId,
  settings: RoomSettings,
): PlayOutcome => {
  if (game.phase !== "trick-play" || game.turnPlayerId !== playerId || !game.trumpSuit) {
    throw createError("INVALID_ACTION", "That card cannot be played right now.");
  }

  const hand = game.hands[playerId] ?? [];
  const card = hand.find((entry) => entry.id === cardId);
  if (!card) {
    throw createError("ILLEGAL_MOVE", "That card is not in your hand.");
  }

  const legalCardIds = getLegalCardsForPlayer(game, playerId);
  if (!legalCardIds.includes(cardId)) {
    throw createError("ILLEGAL_MOVE", "You must follow suit when you can.");
  }

  const trick = ensureCurrentTrick(game);
  game.hands[playerId] = hand.filter((entry) => entry.id !== cardId);
  trick.cards.push({
    playerId,
    card,
  });

  if (!trick.ledSuit) {
    trick.ledSuit = card.suit;
  }

  maybeRevealPartner(game, playerId, cardId);

  const playerIds = getPlayerIdsClockwise(players);
  if (trick.cards.length < players.length) {
    game.turnPlayerId = getNextClockwiseId(playerIds, playerId);
    return {
      trickCompleted: false,
      handCompleted: false,
    };
  }

  trick.winnerId = determineTrickWinner(trick, game.trumpSuit);
  trick.collectedPoints = getTrickPoints(trick.cards.map((entry) => entry.card));
  game.lastTrickWinnerId = trick.winnerId;
  game.completedTricks.push({
    ...trick,
    cards: [...trick.cards],
  });
  game.turnPlayerId = trick.winnerId;

  const handCompleted = Object.values(game.hands).every((cards) => cards.length === 0);
  if (handCompleted) {
    const summary = buildHandSummary(game, players, settings);
    return {
      trickCompleted: true,
      handCompleted: true,
      summary,
      winnerId: trick.winnerId!,
    };
  }

  return {
    trickCompleted: true,
    handCompleted: false,
    winnerId: trick.winnerId!,
  };
};

export const continueFromSummary = (game: ServerGameState, players: ServerPlayer[]): void => {
  if (game.phase !== "round-summary") {
    throw createError("INVALID_ACTION", "The next hand cannot start yet.");
  }

  prepareHand(game, players);
};

export const describeGameStatus = (game: ServerGameState | null, players: ServerPlayer[]): string => {
  if (!game) {
    return STATUS_COPY.lobby;
  }

  const playerNameById = Object.fromEntries(players.map((player) => [player.id, player.name]));

  switch (game.phase) {
    case "dealing":
      return `Hand ${game.handNumber} is being dealt by ${playerNameById[getDealerId(game, players)]}.`;
    case "bidding":
      return game.bidState?.currentBid
        ? `${playerNameById[game.bidState.highestBidderId!]} leads the bidding at ${game.bidState.currentBid}.`
        : "The auction opens at 150.";
    case "partner-selection":
      return `${playerNameById[game.declarerId!]} is calling the partner pattern.`;
    case "trump-selection":
      return `${playerNameById[game.declarerId!]} is choosing the sir.`;
    case "trick-play":
      return `${playerNameById[game.turnPlayerId!]} is on lead.`;
    case "round-summary":
      return `Hand ${game.handNumber} has been scored.`;
    case "game-over":
      return `${game.winningPlayerIds.map((playerId) => playerNameById[playerId]).join(", ")} win the session.`;
    default:
      return STATUS_COPY[game.phase];
  }
};
