import { describe, expect, it } from "vitest";
import { buildDeckForPlayerCount } from "./deck.js";
import { beginBidding, createMatch, playCard, prepareHand, selectPartners, submitBid } from "./gameEngine.js";
import { expectAppErrorCode, card, makePlayers } from "../testHelpers.js";

describe("bidding flow", () => {
  it("starts with the player to the left of the dealer", () => {
    const players = makePlayers(4);
    const game = createMatch(players);

    prepareHand(game, players, { sameDealer: true });
    beginBidding(game, players);

    expect(game.bidState?.activePlayerId).toBe(players[1]!.id);
  });

  it("rejects illegal bid increments", () => {
    const players = makePlayers(4);
    const game = createMatch(players);

    prepareHand(game, players, { sameDealer: true });
    beginBidding(game, players);

    expectAppErrorCode(() => submitBid(game, players[1]!.id, { action: "bid", amount: 152 }), "BID_INVALID");
  });
});

describe("partner resolution", () => {
  it("uses hidden fallback cards until two distinct partners are found for 6+ players", () => {
    const players = makePlayers(6);
    const game = createMatch(players);
    const deck = buildDeckForPlayerCount(6);

    game.phase = "partner-selection";
    game.declarerId = players[0]!.id;
    game.activeDeck = deck;
    game.hands = {
      [players[0]!.id]: [card("A", "spades"), card("K", "spades")],
      [players[1]!.id]: [card("A", "clubs"), card("K", "clubs"), card("Q", "clubs"), card("J", "clubs")],
      [players[2]!.id]: [card("10", "clubs"), card("9", "clubs")],
      [players[3]!.id]: [card("A", "hearts")],
      [players[4]!.id]: [card("A", "diamonds")],
      [players[5]!.id]: [card("K", "hearts")],
    };

    selectPartners(game, players, players[0]!.id, {
      primaryCardIds: ["AC", "KC"],
      backupCardIds: ["QC", "JC"],
    });

    expect(game.partnerSelection?.resolvedPartnerIds).toEqual([players[1]!.id, players[2]!.id]);
    expect(game.partnerSelection?.resolvedCardIdsByPlayerId[players[2]!.id]).toBe("10C");
    expect(game.partnerSelection?.hiddenFallbackCardIds[0]).toBe("10C");
  });
});

describe("authoritative legal play", () => {
  it("rejects an off-suit card when the player can follow suit", () => {
    const players = makePlayers(4);
    const game = createMatch(players);

    game.phase = "trick-play";
    game.declarerId = players[0]!.id;
    game.trumpSuit = "clubs";
    game.turnPlayerId = players[1]!.id;
    game.hands = {
      [players[0]!.id]: [card("A", "clubs")],
      [players[1]!.id]: [card("K", "hearts"), card("A", "spades")],
      [players[2]!.id]: [card("5", "hearts")],
      [players[3]!.id]: [card("K", "spades")],
    };
    game.currentTrick = {
      leaderId: players[0]!.id,
      ledSuit: "hearts",
      winnerId: null,
      trickNumber: 1,
      collectedPoints: 0,
      cards: [{ playerId: players[0]!.id, card: card("A", "hearts") }],
    };

    expectAppErrorCode(
      () =>
        playCard(game, players, players[1]!.id, "AS", {
          maxPlayers: 4,
          gameMode: "target-score",
          targetScore: 1000,
          rounds: 5,
        }),
      "ILLEGAL_MOVE",
    );
  });
});

describe("end conditions", () => {
  it("keeps rounds mode going into a tiebreak hand when the top score is tied", () => {
    const players = makePlayers(4);
    const game = createMatch(players);

    game.phase = "trick-play";
    game.handNumber = 1;
    game.dealerIndex = 0;
    game.declarerId = players[0]!.id;
    game.trumpSuit = "clubs";
    game.turnPlayerId = players[1]!.id;
    game.bidState = {
      currentBid: 180,
      highestBidderId: players[0]!.id,
      activePlayerId: null,
      passedPlayerIds: [players[1]!.id, players[2]!.id, players[3]!.id],
      order: players.map((player) => player.id),
      history: [],
      activePlayerIds: [players[0]!.id],
    };
    game.partnerSelection = {
      requiredPartners: 1,
      primaryCardIds: ["AD"],
      backupCardIds: [],
      revealedPartnerIds: [],
      resolvedPartnerIds: [players[1]!.id],
      resolvedCardIdsByPlayerId: { [players[1]!.id]: "AD" },
      hiddenFallbackCardIds: [],
      holderByCardId: { AD: players[1]!.id },
    };
    game.score.totals = {
      [players[0]!.id]: 100,
      [players[1]!.id]: 100,
      [players[2]!.id]: 0,
      [players[3]!.id]: 0,
    };
    game.hands = {
      [players[0]!.id]: [card("A", "clubs")],
      [players[1]!.id]: [card("A", "diamonds")],
      [players[2]!.id]: [card("5", "hearts")],
      [players[3]!.id]: [card("K", "spades")],
    };
    game.currentTrick = {
      leaderId: players[1]!.id,
      ledSuit: null,
      winnerId: null,
      trickNumber: 1,
      collectedPoints: 0,
      cards: [],
    };

    playCard(game, players, players[1]!.id, "AD", { maxPlayers: 4, gameMode: "rounds", targetScore: 1000, rounds: 1 });
    playCard(game, players, players[2]!.id, "5H", { maxPlayers: 4, gameMode: "rounds", targetScore: 1000, rounds: 1 });
    playCard(game, players, players[3]!.id, "KS", { maxPlayers: 4, gameMode: "rounds", targetScore: 1000, rounds: 1 });
    const outcome = playCard(game, players, players[0]!.id, "AC", { maxPlayers: 4, gameMode: "rounds", targetScore: 1000, rounds: 1 });

    expect(outcome.handCompleted).toBe(true);
    expect(game.phase).toBe("round-summary");
    expect(game.winningPlayerIds).toEqual([]);
  });

  it("keeps target score mode going when the target is reached in a tie", () => {
    const players = makePlayers(4);
    const game = createMatch(players);

    game.phase = "trick-play";
    game.handNumber = 1;
    game.dealerIndex = 0;
    game.declarerId = players[0]!.id;
    game.trumpSuit = "clubs";
    game.turnPlayerId = players[1]!.id;
    game.bidState = {
      currentBid: 180,
      highestBidderId: players[0]!.id,
      activePlayerId: null,
      passedPlayerIds: [players[1]!.id, players[2]!.id, players[3]!.id],
      order: players.map((player) => player.id),
      history: [],
      activePlayerIds: [players[0]!.id],
    };
    game.partnerSelection = {
      requiredPartners: 1,
      primaryCardIds: ["AD"],
      backupCardIds: [],
      revealedPartnerIds: [],
      resolvedPartnerIds: [players[1]!.id],
      resolvedCardIdsByPlayerId: { [players[1]!.id]: "AD" },
      hiddenFallbackCardIds: [],
      holderByCardId: { AD: players[1]!.id },
    };
    game.score.totals = {
      [players[0]!.id]: 90,
      [players[1]!.id]: 90,
      [players[2]!.id]: 0,
      [players[3]!.id]: 0,
    };
    game.hands = {
      [players[0]!.id]: [card("A", "clubs")],
      [players[1]!.id]: [card("A", "diamonds")],
      [players[2]!.id]: [card("5", "hearts")],
      [players[3]!.id]: [card("K", "spades")],
    };
    game.currentTrick = {
      leaderId: players[1]!.id,
      ledSuit: null,
      winnerId: null,
      trickNumber: 1,
      collectedPoints: 0,
      cards: [],
    };

    playCard(game, players, players[1]!.id, "AD", { maxPlayers: 4, gameMode: "target-score", targetScore: 180, rounds: 5 });
    playCard(game, players, players[2]!.id, "5H", { maxPlayers: 4, gameMode: "target-score", targetScore: 180, rounds: 5 });
    playCard(game, players, players[3]!.id, "KS", { maxPlayers: 4, gameMode: "target-score", targetScore: 180, rounds: 5 });
    playCard(game, players, players[0]!.id, "AC", { maxPlayers: 4, gameMode: "target-score", targetScore: 180, rounds: 5 });

    expect(game.phase).toBe("round-summary");
    expect(game.winningPlayerIds).toEqual([]);
  });
});
