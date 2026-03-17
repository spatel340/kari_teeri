import { expect } from "vitest";
import { createCard } from "@kari-teeri/shared";
import type { Card, Rank, Suit } from "@kari-teeri/shared";
import type { ServerPlayer } from "./types.js";

export const makePlayers = (count: number): ServerPlayer[] =>
  Array.from({ length: count }, (_, index) => ({
    id: `player-${index + 1}`,
    token: `token-${index + 1}`,
    socketId: `socket-${index + 1}`,
    name: `Player ${index + 1}`,
    seatIndex: index,
    isHost: index === 0,
    isBot: false,
    isConnected: true,
    avatarHue: index * 30,
    joinedAt: index + 1,
    disconnectedAt: null,
  }));

export const card = (rank: Rank, suit: Suit): Card => createCard(rank, suit);

export const expectAppErrorCode = (runner: () => unknown, code: string) => {
  try {
    runner();
  } catch (error) {
    expect((error as { code?: string }).code).toBe(code);
    return;
  }

  throw new Error(`Expected app error ${code}, but no error was thrown.`);
};
