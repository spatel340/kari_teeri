import { describe, expect, it } from "vitest";
import { determineTrickWinner, getLegalCardIds } from "./rules.js";
import { card } from "../testHelpers.js";

describe("legal play", () => {
  it("forces a player to follow suit when possible", () => {
    const legal = getLegalCardIds(
      [card("K", "hearts"), card("A", "spades")],
      {
        leaderId: "player-1",
        ledSuit: "hearts",
        winnerId: null,
        trickNumber: 1,
        collectedPoints: 0,
        cards: [{ playerId: "player-1", card: card("A", "hearts") }],
      },
    );

    expect(legal).toEqual(["KH"]);
  });
});

describe("trick winner logic", () => {
  it("makes 3S beat every other card as Kali Teeri", () => {
    const winner = determineTrickWinner(
      {
        leaderId: "player-1",
        ledSuit: "hearts",
        winnerId: null,
        trickNumber: 1,
        collectedPoints: 0,
        cards: [
          { playerId: "player-1", card: card("A", "hearts") },
          { playerId: "player-2", card: card("A", "clubs") },
          { playerId: "player-3", card: card("3", "spades") },
          { playerId: "player-4", card: card("K", "clubs") },
        ],
      },
      "clubs",
    );

    expect(winner).toBe("player-3");
  });

  it("otherwise uses the highest trump, then the led suit", () => {
    const winner = determineTrickWinner(
      {
        leaderId: "player-1",
        ledSuit: "diamonds",
        winnerId: null,
        trickNumber: 1,
        collectedPoints: 0,
        cards: [
          { playerId: "player-1", card: card("A", "diamonds") },
          { playerId: "player-2", card: card("9", "clubs") },
          { playerId: "player-3", card: card("K", "clubs") },
          { playerId: "player-4", card: card("Q", "diamonds") },
        ],
      },
      "clubs",
    );

    expect(winner).toBe("player-3");
  });
});
