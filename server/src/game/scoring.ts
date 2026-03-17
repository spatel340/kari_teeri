import { TOTAL_HAND_POINTS } from "@kari-teeri/shared";

export const resolveHandScore = (bid: number, declarerTeamPoints: number) => {
  const bidSucceeded = declarerTeamPoints >= bid;

  if (bidSucceeded) {
    return {
      bidSucceeded,
      declarerAward: bid,
      opponentAward: TOTAL_HAND_POINTS - bid
    };
  }

  return {
    bidSucceeded,
    declarerAward: 0,
    opponentAward: bid
  };
};
