import { describe, expect, it } from "vitest";
import { buildDeckForPlayerCount, dealHands } from "./deck.js";
import { makePlayers } from "../testHelpers.js";

describe("deck rules", () => {
  it("removes the correct 2s for each supported player count", () => {
    expect(buildDeckForPlayerCount(4)).toHaveLength(52);
    expect(buildDeckForPlayerCount(5).some((card) => card.id === "2C")).toBe(false);
    expect(buildDeckForPlayerCount(5).some((card) => card.id === "2D")).toBe(false);
    expect(buildDeckForPlayerCount(5)).toHaveLength(50);
    expect(buildDeckForPlayerCount(6)).toHaveLength(48);
    expect(buildDeckForPlayerCount(7)).toHaveLength(49);
    expect(buildDeckForPlayerCount(8)).toHaveLength(48);
  });

  it("deals evenly for every supported player count", () => {
    const expectedCounts = new Map([
      [4, 13],
      [5, 10],
      [6, 8],
      [7, 7],
      [8, 6],
    ]);

    expectedCounts.forEach((cardsPerPlayer, playerCount) => {
      const players = makePlayers(playerCount);
      const hands = dealHands(buildDeckForPlayerCount(playerCount), players.map((player) => player.id));
      Object.values(hands).forEach((hand) => {
        expect(hand).toHaveLength(cardsPerPlayer);
      });
    });
  });
});
