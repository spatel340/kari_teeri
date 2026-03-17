import { MAX_PLAYERS, MIN_PLAYERS, ROOM_CODE_LENGTH } from "@kari-teeri/shared";
import type { AppError } from "@kari-teeri/shared";
import { randomUUID } from "node:crypto";

const ROOM_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export const createError = (code: AppError["code"], message: string): AppError => ({
  code,
  message,
});

export const normalizeName = (name: string): string => name.replace(/\s+/g, " ").trim();

export const validateName = (name: string): AppError | null => {
  const normalized = normalizeName(name);

  if (!normalized) {
    return createError("INVALID_NAME", "Enter a player name before taking a seat.");
  }

  if (normalized.length < 2 || normalized.length > 18) {
    return createError("INVALID_NAME", "Names should be between 2 and 18 characters.");
  }

  return null;
};

export const validateRoomCode = (roomCode: string): AppError | null => {
  if (!/^[A-Z0-9]{6}$/.test(roomCode)) {
    return createError("INVALID_ROOM", "That room code does not look right.");
  }

  return null;
};

export const generateToken = (): string => randomUUID();

export const generateRoomCode = (existingCodes: Set<string>): string => {
  let roomCode = "";

  while (!roomCode || existingCodes.has(roomCode)) {
    roomCode = Array.from({ length: ROOM_CODE_LENGTH }, () => ROOM_ALPHABET[Math.floor(Math.random() * ROOM_ALPHABET.length)]).join("");
  }

  return roomCode;
};

export const clampPlayerCount = (value: number): 4 | 5 | 6 | 7 | 8 => {
  const rounded = Math.round(value);
  const clamped = Math.max(MIN_PLAYERS, Math.min(MAX_PLAYERS, rounded));
  return clamped as 4 | 5 | 6 | 7 | 8;
};

export const now = (): number => Date.now();
