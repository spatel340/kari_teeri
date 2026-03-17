import { formatCardId } from "@kari-teeri/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildDeckForPlayerCount } from "./game/deck.js";
import { createMatch } from "./game/gameEngine.js";
import { RoomManager } from "./roomManager.js";
import { card } from "./testHelpers.js";

describe("room lifecycle", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
  });

  it("reconnects a player inside the 60 second reservation window", () => {
    const roomManager = new RoomManager(() => undefined, () => undefined);
    const host = roomManager.createRoom("Host", null, "socket-1");

    roomManager.handleDisconnect(host.roomCode, host.playerId);
    vi.advanceTimersByTime(30_000);

    const reconnected = roomManager.reconnectRoom(host.roomCode, host.reconnectToken, "socket-2");
    expect(reconnected.playerId).toBe(host.playerId);
    expect(roomManager.getRoomForCode(host.roomCode)?.players[0]?.isConnected).toBe(true);
  });

  it("destroys the room only after no connected or reconnectable players remain", () => {
    const expiredRooms: string[] = [];
    const roomManager = new RoomManager(() => undefined, (roomCode) => expiredRooms.push(roomCode));
    const host = roomManager.createRoom("Host", null, "socket-1");

    roomManager.handleDisconnect(host.roomCode, host.playerId);
    vi.advanceTimersByTime(59_000);
    expect(roomManager.getRoomForCode(host.roomCode)).not.toBeNull();

    vi.advanceTimersByTime(1_000);
    expect(roomManager.getRoomForCode(host.roomCode)).toBeNull();
    expect(expiredRooms).toContain(host.roomCode);
  });

  it("transfers host to the longest-present remaining player", () => {
    const roomManager = new RoomManager(() => undefined, () => undefined);
    const host = roomManager.createRoom("Host", null, "socket-1");

    vi.advanceTimersByTime(1_000);
    const second = roomManager.joinRoom(host.roomCode, "Second", null, "socket-2");
    vi.advanceTimersByTime(1_000);
    roomManager.joinRoom(host.roomCode, "Third", null, "socket-3");

    roomManager.leaveRoom(host.roomCode, host.playerId);

    const room = roomManager.getRoomForCode(host.roomCode)!;
    expect(room.players.find((player) => player.isHost)?.id).toBe(second.playerId);
  });

  it("lets a lobby player add and remove smart bots", () => {
    const roomManager = new RoomManager(() => undefined, () => undefined);
    const host = roomManager.createRoom("Host", null, "socket-1");

    roomManager.addSmartBot(host.roomCode, host.playerId);
    roomManager.addSmartBot(host.roomCode, host.playerId);

    const roomWithBots = roomManager.getRoomForCode(host.roomCode)!;
    expect(roomWithBots.players.filter((player) => player.isBot)).toHaveLength(2);
    expect(roomWithBots.players.filter((player) => player.isBot).map((player) => player.name)).toEqual(["Smart Bot 1", "Smart Bot 2"]);

    roomManager.removeSmartBot(host.roomCode, host.playerId);

    const updatedRoom = roomManager.getRoomForCode(host.roomCode)!;
    expect(updatedRoom.players.filter((player) => player.isBot).map((player) => player.name)).toEqual(["Smart Bot 1"]);
  });

  it("lets a human take a full-room bot seat from the lobby", () => {
    const roomManager = new RoomManager(() => undefined, () => undefined);
    const host = roomManager.createRoom("Host", null, "socket-1");

    roomManager.updateSettings(host.roomCode, host.playerId, { maxPlayers: 4 });
    roomManager.addSmartBot(host.roomCode, host.playerId);
    roomManager.addSmartBot(host.roomCode, host.playerId);
    roomManager.addSmartBot(host.roomCode, host.playerId);

    const joinResult = roomManager.joinRoom(host.roomCode, "Late Human", null, "socket-2");
    const room = roomManager.getRoomForCode(host.roomCode)!;

    expect(joinResult.roomCode).toBe(host.roomCode);
    expect(room.players).toHaveLength(4);
    expect(room.players.some((player) => player.id === joinResult.playerId && !player.isBot)).toBe(true);
    expect(room.players.filter((player) => player.isBot)).toHaveLength(2);
  });

  it("destroys a bot-filled room when the last human leaves", () => {
    const expiredRooms: string[] = [];
    const roomManager = new RoomManager(() => undefined, (roomCode) => expiredRooms.push(roomCode));
    const host = roomManager.createRoom("Host", null, "socket-1");

    roomManager.addSmartBot(host.roomCode, host.playerId);
    roomManager.addSmartBot(host.roomCode, host.playerId);
    roomManager.leaveRoom(host.roomCode, host.playerId);

    expect(roomManager.getRoomForCode(host.roomCode)).toBeNull();
    expect(expiredRooms).toContain(host.roomCode);
  });

  it("advances a smart bot turn automatically once bidding begins", () => {
    const roomManager = new RoomManager(() => undefined, () => undefined);
    const host = roomManager.createRoom("Host", null, "socket-1");

    roomManager.addSmartBot(host.roomCode, host.playerId);
    roomManager.addSmartBot(host.roomCode, host.playerId);
    roomManager.addSmartBot(host.roomCode, host.playerId);
    roomManager.startGame(host.roomCode, host.playerId);

    vi.advanceTimersByTime(1_800);

    const room = roomManager.getRoomForCode(host.roomCode)!;
    expect(room.game?.phase).toBe("bidding");
    expect((room.game?.bidState?.history.length ?? 0) > 0).toBe(true);
  });

  it("announces the actual called partner cards in the event log", () => {
    const roomManager = new RoomManager(() => undefined, () => undefined);
    const host = roomManager.createRoom("Host", null, "socket-1");
    const second = roomManager.joinRoom(host.roomCode, "Second", null, "socket-2");
    const third = roomManager.joinRoom(host.roomCode, "Third", null, "socket-3");
    const fourth = roomManager.joinRoom(host.roomCode, "Fourth", null, "socket-4");
    const room = roomManager.getRoomForCode(host.roomCode)!;

    room.game = createMatch(room.players);
    room.game.phase = "partner-selection";
    room.game.declarerId = host.playerId;
    room.game.activeDeck = buildDeckForPlayerCount(4);
    room.game.hands = {
      [host.playerId]: [card("A", "spades")],
      [second.playerId]: [card("A", "diamonds")],
      [third.playerId]: [card("A", "clubs")],
      [fourth.playerId]: [card("A", "hearts")],
    };

    roomManager.selectPartners(host.roomCode, host.playerId, {
      primaryCardIds: ["AD"],
      backupCardIds: [],
    });

    expect(room.notifications[0]?.message).toBe(`Host called partner card ${formatCardId("AD")}.`);
  });
});
