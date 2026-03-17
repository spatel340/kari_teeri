import { describe, expect, it } from "vitest";
import { resolveHandScore } from "./scoring.js";

describe("scoring", () => {
  it("awards the bid to the declarer side when the contract is made", () => {
    expect(resolveHandScore(180, 190)).toEqual({
      bidSucceeded: true,
      declarerAward: 180,
      opponentAward: 70,
    });
  });

  it("sets the declarer side to zero when the contract fails", () => {
    expect(resolveHandScore(180, 160)).toEqual({
      bidSucceeded: false,
      declarerAward: 0,
      opponentAward: 180,
    });
  });
});
