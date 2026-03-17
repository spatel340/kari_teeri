import { describe, expect, it } from "vitest";
import { card, makePlayers } from "../testHelpers.js";
import { createMatch } from "./gameEngine.js";
import { chooseSmartBotBid, chooseSmartBotCard, chooseSmartBotPartners, chooseSmartBotTrump } from "./smartBot.js";

describe("smart bot bidding", () => {
  it("opens with a bid when holding a strong hand", () => {
    const players = makePlayers(4);
    const game = createMatch(players);

    game.bidState = {
      currentBid: null,
      highestBidderId: null,
      activePlayerId: players[1]!.id,
      passedPlayerIds: [],
      order: players.map((player) => player.id),
      history: [],
      activePlayerIds: players.map((player) => player.id),
    };
    game.hands = {
      [players[0]!.id]: [],
      [players[1]!.id]: [card("A", "spades"), card("K", "spades"), card("Q", "spades"), card("J", "spades"), card("3", "spades")],
      [players[2]!.id]: [],
      [players[3]!.id]: [],
    };

    expect(chooseSmartBotBid(game, players[1]!.id)).toEqual({ action: "bid", amount: 150 });
  });

  it("passes when the table is already at the max bid", () => {
    const players = makePlayers(4);
    const game = createMatch(players);

    game.bidState = {
      currentBid: 250,
      highestBidderId: players[2]!.id,
      activePlayerId: players[1]!.id,
      passedPlayerIds: [],
      order: players.map((player) => player.id),
      history: [],
      activePlayerIds: players.map((player) => player.id),
    };
    game.hands = {
      [players[0]!.id]: [],
      [players[1]!.id]: [card("A", "spades"), card("K", "spades"), card("Q", "spades"), card("J", "spades"), card("3", "spades")],
      [players[2]!.id]: [],
      [players[3]!.id]: [],
    };

    expect(chooseSmartBotBid(game, players[1]!.id)).toEqual({ action: "pass" });
  });
});

describe("smart bot planning", () => {
  it("chooses trump from its strongest suit", () => {
    const players = makePlayers(4);
    const game = createMatch(players);

    game.hands = {
      [players[0]!.id]: [],
      [players[1]!.id]: [card("A", "hearts"), card("K", "hearts"), card("Q", "hearts"), card("5", "spades")],
      [players[2]!.id]: [],
      [players[3]!.id]: [],
    };

    expect(chooseSmartBotTrump(game, players[1]!.id)).toBe("hearts");
  });

  it("calls high-value partner cards outside its hand", () => {
    const players = makePlayers(6);
    const game = createMatch(players);

    game.activeDeck = [card("A", "clubs"), card("K", "clubs"), card("Q", "clubs"), card("J", "clubs"), card("10", "diamonds")];
    game.hands = {
      [players[0]!.id]: [card("A", "spades")],
      [players[1]!.id]: [],
      [players[2]!.id]: [],
      [players[3]!.id]: [],
      [players[4]!.id]: [],
      [players[5]!.id]: [],
    };

    const choice = chooseSmartBotPartners(game, players[0]!.id);
    expect(choice.primaryCardIds).toEqual(["AC", "KC"]);
    expect(choice.backupCardIds).toEqual(["QC", "JC"]);
  });
});

describe("smart bot trick play", () => {
  it("follows suit and uses a winning card when the trick is valuable", () => {
    const players = makePlayers(4);
    const game = createMatch(players);

    game.phase = "trick-play";
    game.trumpSuit = "clubs";
    game.turnPlayerId = players[1]!.id;
    game.declarerId = players[0]!.id;
    game.partnerSelection = {
      requiredPartners: 1,
      primaryCardIds: ["AH"],
      backupCardIds: [],
      revealedPartnerIds: [],
      resolvedPartnerIds: [players[1]!.id],
      resolvedCardIdsByPlayerId: { [players[1]!.id]: "AH" },
      hiddenFallbackCardIds: [],
      holderByCardId: { AH: players[1]!.id },
    };
    game.hands = {
      [players[0]!.id]: [card("A", "clubs")],
      [players[1]!.id]: [card("K", "hearts"), card("4", "hearts"), card("2", "spades")],
      [players[2]!.id]: [card("A", "hearts")],
      [players[3]!.id]: [card("5", "clubs")],
    };
    game.currentTrick = {
      leaderId: players[0]!.id,
      ledSuit: "hearts",
      winnerId: null,
      trickNumber: 1,
      collectedPoints: 0,
      cards: [{ playerId: players[2]!.id, card: card("Q", "hearts") }],
    };

    expect(chooseSmartBotCard(game, players, players[1]!.id)).toBe("KH");
  });
});
