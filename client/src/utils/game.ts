import { SUIT_SYMBOLS, formatCardId } from "@kari-teeri/shared";
import type { Card, Player, PlayerRole, Suit } from "@kari-teeri/shared";

export const suitColorClass = (suit: Suit): string =>
  suit === "hearts" || suit === "diamonds" ? "text-rose-500" : "text-slate-900";

export const suitGlowClass = (suit: Suit): string =>
  suit === "hearts" || suit === "diamonds" ? "shadow-rose-500/30" : "shadow-sky-900/30";

export const getInitials = (name: string): string =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((chunk) => chunk[0]!.toUpperCase())
    .join("");

export const getRoleLabel = (role: PlayerRole): string => {
  switch (role) {
    case "declarer":
      return "Declarer";
    case "partner":
      return "Partner";
    case "opponent":
      return "Opponent";
    default:
      return "Waiting";
  }
};

export const arrangePlayersAroundLocal = (players: Player[], meId: string): Player[] => {
  const ordered = [...players].sort((left, right) => left.seatIndex - right.seatIndex);
  const meIndex = ordered.findIndex((player) => player.id === meId);
  if (meIndex === -1) {
    return ordered;
  }

  return [...ordered.slice(meIndex), ...ordered.slice(0, meIndex)];
};

export const getSeatPlacement = (totalPlayers: number, relativeIndex: number) => {
  if (relativeIndex === 0) {
    return { left: "50%", top: "90%", transform: "translate(-50%, -50%)" };
  }

  if (totalPlayers === 4) {
    const placements = [
      { left: "50%", top: "14%", transform: "translate(-50%, -50%)" },
      { left: "14%", top: "50%", transform: "translate(-50%, -50%)" },
      { left: "86%", top: "50%", transform: "translate(-50%, -50%)" },
    ];

    return placements[relativeIndex - 1]!;
  }

  const remoteCount = totalPlayers - 1;
  const angle = (-160 + ((relativeIndex - 1) * 320) / Math.max(1, remoteCount - 1)) * (Math.PI / 180);
  const x = 50 + Math.cos(angle) * 37;
  const y = 50 + Math.sin(angle) * 29;

  return {
    left: `${x}%`,
    top: `${y}%`,
    transform: "translate(-50%, -50%)",
  };
};

export const cardLabel = (card: Card): string => formatCardId(card.id);

export const suitSymbol = (suit: Suit): string => SUIT_SYMBOLS[suit];
