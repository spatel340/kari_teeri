import { DEFAULT_ROUNDS, DEFAULT_TARGET_SCORE, MAX_PLAYERS, MIN_PLAYERS, formatCardId } from "@kari-teeri/shared";
import type {
  Card,
  JoinRoomResult,
  PrivatePlayerState,
  PublicGameState,
  PublicRoomState,
  RemoveSmartBotInput,
  RoomSnapshot,
  Suit,
  UpdateSettingsInput,
} from "@kari-teeri/shared";
import { beginBidding, continueFromSummary, createMatch, describeGameStatus, getKnownOpponentIds, getKnownPartnerIds, getLegalCardsForPlayer, getPrivateRole, getSecretNotice, playCard, prepareHand, selectPartners, selectTrump, submitBid } from "./game/gameEngine.js";
import { chooseSmartBotBid, chooseSmartBotCard, chooseSmartBotPartners, chooseSmartBotTrump } from "./game/smartBot.js";
import type { RoomSession, ServerPlayer } from "./types.js";
import { clampPlayerCount, createError, generateRoomCode, generateToken, normalizeName, now, validateName, validateRoomCode } from "./utils.js";

const DISCONNECT_GRACE_MS = 60_000;
const DEALING_DELAY_MS = 900;
const BOT_ACTION_DELAY_MS = 800;
const SMART_BOT_PREFIX = "Smart Bot";

type PublishRoom = (room: RoomSession) => void;

export class RoomManager {
  private rooms = new Map<string, RoomSession>();
  private disconnectTimers = new Map<string, NodeJS.Timeout>();
  private roomTimers = new Map<string, NodeJS.Timeout>();
  private botTimers = new Map<string, NodeJS.Timeout>();

  constructor(
    private readonly publishRoom: PublishRoom,
    private readonly publishExpired: (roomCode: string) => void,
  ) {}

  createRoom(name: string, token: string | null, socketId: string): JoinRoomResult {
    const validation = validateName(name);
    if (validation) {
      throw validation;
    }

    const roomCode = generateRoomCode(new Set(this.rooms.keys()));
    const reconnectToken = token ?? generateToken();
    const playerId = generateToken();
    const createdAt = now();

    const player: ServerPlayer = {
      id: playerId,
      token: reconnectToken,
      socketId,
      name: normalizeName(name),
      seatIndex: 0,
      isHost: true,
      isBot: false,
      isConnected: true,
      avatarHue: Math.floor(Math.random() * 360),
      joinedAt: createdAt,
      disconnectedAt: null,
    };

    const room: RoomSession = {
      code: roomCode,
      createdAt,
      players: [player],
      settings: {
        maxPlayers: 6,
        gameMode: "target-score",
        targetScore: DEFAULT_TARGET_SCORE,
        rounds: DEFAULT_ROUNDS,
      },
      notifications: [
        {
          id: `note-${createdAt}`,
          message: `${player.name} opened the table.`,
          tone: "success",
          timestamp: createdAt,
        },
      ],
      game: null,
    };

    this.rooms.set(roomCode, room);
    this.publishRoomState(room);

    return {
      roomCode,
      playerId,
      reconnectToken,
    };
  }

  joinRoom(roomCode: string, name: string, token: string | null, socketId: string): JoinRoomResult {
    const normalizedCode = roomCode.toUpperCase();
    const roomCodeError = validateRoomCode(normalizedCode);
    if (roomCodeError) {
      throw roomCodeError;
    }

    const nameError = validateName(name);
    if (nameError) {
      throw nameError;
    }

    const room = this.rooms.get(normalizedCode);
    if (!room) {
      throw createError("ROOM_EXPIRED", "That room has already expired.");
    }

    if (room.game) {
      throw createError("INVALID_ACTION", "Wait for the current session to end before joining this room.");
    }

    if (token) {
      const knownPlayer = room.players.find((player) => player.token === token);
      if (knownPlayer) {
        return this.reconnectRoom(normalizedCode, token, socketId);
      }
    }

    const normalizedName = normalizeName(name);
    if (room.players.some((player) => player.name.toLowerCase() === normalizedName.toLowerCase())) {
      throw createError("DUPLICATE_NAME", "Someone at the table is already using that name.");
    }

    if (room.players.length >= room.settings.maxPlayers) {
      if (this.releaseBotSeat(room) === null) {
        throw createError("ROOM_FULL", "This room is already full.");
      }

      this.addNotification(room, `A smart bot stepped aside so ${normalizedName} could join.`, "success");
    }

    const highestSeatIndex = room.players.reduce((highest, player) => Math.max(highest, player.seatIndex), -1);
    const releasedSeatIndex = this.getOpenSeatIndices(room)[0] ?? highestSeatIndex + 1;
    const joinedAt = now();
    const playerId = generateToken();
    const reconnectToken = token ?? generateToken();

    room.players.push({
      id: playerId,
      token: reconnectToken,
      socketId,
      name: normalizedName,
      seatIndex: releasedSeatIndex,
      isHost: false,
      isBot: false,
      isConnected: true,
      avatarHue: Math.floor(Math.random() * 360),
      joinedAt,
      disconnectedAt: null,
    });

    this.addNotification(room, `${normalizedName} joined the room.`);
    this.publishRoomState(room);

    return {
      roomCode: normalizedCode,
      playerId,
      reconnectToken,
    };
  }

  addSmartBot(roomCode: string, playerId: string): void {
    const room = this.getRoom(roomCode);
    this.ensureLobbyBotControl(room, playerId);

    if (room.players.length >= room.settings.maxPlayers) {
      throw createError("ROOM_FULL", "The table is already at its seat limit.");
    }

    const seatIndex = this.getOpenSeatIndices(room)[0] ?? room.players.length;
    const botName = this.createSmartBotName(room.players);
    const joinedAt = now();

    room.players.push({
      id: generateToken(),
      token: generateToken(),
      socketId: null,
      name: botName,
      seatIndex,
      isHost: false,
      isBot: true,
      isConnected: true,
      avatarHue: 200 + Math.floor(Math.random() * 80),
      joinedAt,
      disconnectedAt: null,
    });

    this.addNotification(room, `${botName} joined as a smart bot helper.`, "success");
    this.publishRoomState(room);
  }

  reconnectRoom(roomCode: string, token: string, socketId: string): JoinRoomResult {
    const normalizedCode = roomCode.toUpperCase();
    const room = this.rooms.get(normalizedCode);
    if (!room) {
      throw createError("ROOM_EXPIRED", "That room has already expired.");
    }

    const player = room.players.find((entry) => entry.token === token);
    if (!player) {
      throw createError("ROOM_EXPIRED", "Your seat is no longer available in this room.");
    }

    const timerKey = `${normalizedCode}:${player.id}`;
    const timer = this.disconnectTimers.get(timerKey);
    if (timer) {
      clearTimeout(timer);
      this.disconnectTimers.delete(timerKey);
    }

    player.socketId = socketId;
    player.isConnected = true;
    player.disconnectedAt = null;
    this.publishRoomState(room);

    return {
      roomCode: normalizedCode,
      playerId: player.id,
      reconnectToken: player.token,
    };
  }

  removeSmartBot(roomCode: string, playerId: string, input?: RemoveSmartBotInput): void {
    const room = this.getRoom(roomCode);
    this.ensureLobbyBotControl(room, playerId);

    const targetBot =
      input?.botPlayerId !== undefined
        ? room.players.find((player) => player.id === input.botPlayerId && player.isBot)
        : this.getLatestBot(room.players);

    if (!targetBot) {
      throw createError("INVALID_ACTION", "There are no smart bots to remove.");
    }

    room.players = room.players.filter((player) => player.id !== targetBot.id);
    this.addNotification(room, `${targetBot.name} was removed from the lobby.`, "warning");
    this.publishRoomState(room);
  }

  handleDisconnect(roomCode: string, playerId: string): void {
    const room = this.rooms.get(roomCode);
    if (!room) {
      return;
    }

    const player = room.players.find((entry) => entry.id === playerId);
    if (!player) {
      return;
    }

    player.socketId = null;
    player.isConnected = false;
    player.disconnectedAt = now();
    this.addNotification(room, `${player.name} disconnected. Their seat will be held for 60 seconds.`, "warning");
    this.publishRoomState(room);

    const timerKey = `${roomCode}:${playerId}`;
    const timer = setTimeout(() => {
      this.disconnectTimers.delete(timerKey);
      this.removePlayer(roomCode, playerId, "timed out");
    }, DISCONNECT_GRACE_MS);

    this.disconnectTimers.set(timerKey, timer);
  }

  leaveRoom(roomCode: string, playerId: string): void {
    this.removePlayer(roomCode, playerId, "left");
  }

  updateSettings(roomCode: string, playerId: string, input: UpdateSettingsInput): void {
    const room = this.getRoom(roomCode);
    this.ensureHost(room, playerId);

    if (room.game) {
      throw createError("INVALID_ACTION", "Room settings can only be changed from the lobby.");
    }

    const nextMaxPlayers = input.maxPlayers ? clampPlayerCount(input.maxPlayers) : room.settings.maxPlayers;
    if (nextMaxPlayers < room.players.length) {
      throw createError("INVALID_SETTINGS", "The max players setting cannot drop below the current table size.");
    }

    room.settings = {
      maxPlayers: nextMaxPlayers,
      gameMode: input.gameMode ?? room.settings.gameMode,
      targetScore: Math.max(250, Math.min(5000, input.targetScore ?? room.settings.targetScore)),
      rounds: Math.max(1, Math.min(20, Math.round(input.rounds ?? room.settings.rounds))),
    };

    this.addNotification(room, "Room settings were updated.");
    this.publishRoomState(room);
  }

  startGame(roomCode: string, playerId: string): void {
    const room = this.getRoom(roomCode);
    this.ensureHost(room, playerId);

    if (room.players.length < MIN_PLAYERS) {
      throw createError("NOT_ENOUGH_PLAYERS", "Kari Teeri needs at least four players to begin.");
    }

    if (room.players.some((player) => !player.isConnected)) {
      throw createError("INVALID_ACTION", "Wait until everyone is connected before starting.");
    }

    room.game = createMatch(room.players);
    prepareHand(room.game, room.players, { sameDealer: true });
    this.addNotification(room, "The dealer gathers the cards and starts the hand.", "success");
    this.publishRoomState(room);
    this.scheduleDealingAdvance(room.code);
  }

  submitBid(roomCode: string, playerId: string, input: { action: "pass" | "bid"; amount?: number }): void {
    const room = this.getRoom(roomCode);
    if (!room.game) {
      throw createError("INVALID_ACTION", "There is no active game in this room.");
    }

    const outcome = submitBid(room.game, playerId, input);
    const playerName = room.players.find((player) => player.id === playerId)?.name ?? "A player";
    this.addNotification(
      room,
      input.action === "bid" ? `${playerName} bid ${input.amount}.` : `${playerName} passed.`,
      input.action === "bid" ? "neutral" : "warning",
    );

    if (outcome.kind === "all-pass") {
      this.addNotification(room, "Everyone passed. The same dealer redeals.", "warning");
      prepareHand(room.game, room.players, { sameDealer: true, redeal: true });
      this.publishRoomState(room);
      this.scheduleDealingAdvance(room.code);
      return;
    }

    this.publishRoomState(room);
  }

  selectPartners(roomCode: string, playerId: string, input: { primaryCardIds: string[]; backupCardIds: string[] }): void {
    const room = this.getRoom(roomCode);
    if (!room.game) {
      throw createError("INVALID_ACTION", "There is no active game in this room.");
    }

    selectPartners(room.game, room.players, playerId, input);
    const declarerName = room.players.find((player) => player.id === playerId)?.name ?? "The declarer";
    const primaryCards = input.primaryCardIds.map((cardId) => formatCardId(cardId)).join(", ");
    const backupCards = input.backupCardIds.map((cardId) => formatCardId(cardId)).join(", ");
    const message = input.backupCardIds.length
      ? `${declarerName} called partner cards ${primaryCards}. Backups: ${backupCards}.`
      : `${declarerName} called partner card ${primaryCards}.`;

    this.addNotification(room, message);
    this.publishRoomState(room);
  }

  selectTrump(roomCode: string, playerId: string, suit: Suit): void {
    const room = this.getRoom(roomCode);
    if (!room.game) {
      throw createError("INVALID_ACTION", "There is no active game in this room.");
    }

    selectTrump(room.game, room.players, playerId, suit);
    const declarerName = room.players.find((player) => player.id === room.game?.declarerId)?.name ?? "The declarer";
    this.addNotification(room, `${declarerName} named ${suit} as trump.`);
    this.publishRoomState(room);
  }

  playCard(roomCode: string, playerId: string, cardId: string): void {
    const room = this.getRoom(roomCode);
    if (!room.game) {
      throw createError("INVALID_ACTION", "There is no active game in this room.");
    }

    const outcome = playCard(room.game, room.players, playerId, cardId, room.settings);
    if (outcome.trickCompleted && outcome.winnerId) {
      const winnerName = room.players.find((player) => player.id === outcome.winnerId)?.name ?? "A player";
      this.addNotification(room, `${winnerName} won the trick.`, "success");
    }

    if (outcome.handCompleted && outcome.summary) {
      const summary = outcome.summary;
      const declarerName = room.players.find((player) => player.id === summary.declarerId)?.name ?? "The declarer";
      this.addNotification(
        room,
        summary.bidSucceeded
          ? `${declarerName}'s side made the contract.`
          : `${declarerName}'s side fell short of the contract.`,
        summary.bidSucceeded ? "success" : "warning",
      );
    }

    this.publishRoomState(room);
  }

  continueGame(roomCode: string, playerId: string): void {
    const room = this.getRoom(roomCode);
    this.ensureHost(room, playerId);

    if (!room.game) {
      throw createError("INVALID_ACTION", "There is no active game in this room.");
    }

    if (room.players.some((player) => !player.isConnected)) {
      throw createError("INVALID_ACTION", "Wait until everyone is connected before dealing the next hand.");
    }

    continueFromSummary(room.game, room.players);
    this.publishRoomState(room);
    this.scheduleDealingAdvance(room.code);
  }

  returnToLobby(roomCode: string, playerId: string): void {
    const room = this.getRoom(roomCode);
    this.ensureHost(room, playerId);
    room.game = null;
    this.clearRoomTimer(roomCode);
    this.addNotification(room, "The table returned to the lobby.");
    this.publishRoomState(room);
  }

  getSnapshot(roomCode: string, playerId: string): RoomSnapshot {
    return this.buildSnapshot(this.getRoom(roomCode), playerId);
  }

  getRoomForCode(roomCode: string): RoomSession | null {
    return this.rooms.get(roomCode.toUpperCase()) ?? null;
  }

  private scheduleDealingAdvance(roomCode: string): void {
    this.clearRoomTimer(roomCode);
    const timer = setTimeout(() => {
      const room = this.rooms.get(roomCode);
      if (!room?.game || room.game.phase !== "dealing") {
        return;
      }

      beginBidding(room.game, room.players);
      this.publishRoomState(room);
    }, DEALING_DELAY_MS);

    this.roomTimers.set(roomCode, timer);
  }

  private clearRoomTimer(roomCode: string): void {
    const timer = this.roomTimers.get(roomCode);
    if (timer) {
      clearTimeout(timer);
      this.roomTimers.delete(roomCode);
    }
  }

  private removePlayer(roomCode: string, playerId: string, reason: "left" | "timed out"): void {
    const room = this.rooms.get(roomCode);
    if (!room) {
      return;
    }

    const player = room.players.find((entry) => entry.id === playerId);
    if (!player) {
      return;
    }

    const timerKey = `${roomCode}:${playerId}`;
    const disconnectTimer = this.disconnectTimers.get(timerKey);
    if (disconnectTimer) {
      clearTimeout(disconnectTimer);
      this.disconnectTimers.delete(timerKey);
    }

    room.players = room.players.filter((entry) => entry.id !== playerId);

    if (this.getHumanPlayers(room.players).length === 0) {
      this.destroyRoom(roomCode);
      return;
    }

    if (player.isHost) {
      const nextHost = this.getLongestPresentPlayer(this.getHumanPlayers(room.players));
      room.players.forEach((entry) => {
        entry.isHost = entry.id === nextHost?.id;
      });
    }

    this.addNotification(
      room,
      `${player.name} ${reason === "left" ? "left the room." : "did not return in time and was removed."}`,
      "warning",
    );

    if (room.game) {
      room.game = null;
      this.addNotification(room, "The current hand was cancelled and the table returned to the lobby.", "warning");
    }

    this.publishRoomState(room);
  }

  private destroyRoom(roomCode: string): void {
    this.clearRoomTimer(roomCode);
    this.clearBotTimer(roomCode);
    this.rooms.delete(roomCode);
    this.publishExpired(roomCode);
  }

  private getLongestPresentPlayer(players: ServerPlayer[]): ServerPlayer | null {
    if (players.length === 0) {
      return null;
    }

    return [...players].sort((left, right) => {
      if (left.joinedAt !== right.joinedAt) {
        return left.joinedAt - right.joinedAt;
      }

      return left.seatIndex - right.seatIndex;
    })[0]!;
  }

  private ensureLobbyBotControl(room: RoomSession, playerId: string): void {
    const player = room.players.find((entry) => entry.id === playerId);
    if (!player || player.isBot || !player.isConnected) {
      throw createError("UNAUTHORIZED", "Only a connected human player can manage smart bots.");
    }

    if (room.game) {
      throw createError("INVALID_ACTION", "Smart bots can only be changed from the lobby.");
    }
  }

  private createSmartBotName(players: ServerPlayer[]): string {
    const existingNames = new Set(players.map((player) => player.name.toLowerCase()));
    let index = 1;
    let name = `${SMART_BOT_PREFIX} ${index}`;

    while (existingNames.has(name.toLowerCase())) {
      index += 1;
      name = `${SMART_BOT_PREFIX} ${index}`;
    }

    return name;
  }

  private getHumanPlayers(players: ServerPlayer[]): ServerPlayer[] {
    return players.filter((player) => !player.isBot);
  }

  private getLatestBot(players: ServerPlayer[]): ServerPlayer | null {
    const bots = players.filter((player) => player.isBot);
    if (bots.length === 0) {
      return null;
    }

    return [...bots].sort((left, right) => {
      if (left.joinedAt !== right.joinedAt) {
        return right.joinedAt - left.joinedAt;
      }

      return right.seatIndex - left.seatIndex;
    })[0]!;
  }

  private getOpenSeatIndices(room: RoomSession): number[] {
    const occupied = new Set(room.players.map((player) => player.seatIndex));
    return Array.from({ length: room.settings.maxPlayers }, (_, seatIndex) => seatIndex).filter((seatIndex) => !occupied.has(seatIndex));
  }

  private releaseBotSeat(room: RoomSession): number | null {
    const bot = this.getLatestBot(room.players);
    if (!bot) {
      return null;
    }

    room.players = room.players.filter((player) => player.id !== bot.id);
    return bot.seatIndex;
  }

  private addNotification(room: RoomSession, message: string, tone: "neutral" | "success" | "warning" = "neutral"): void {
    room.notifications = [
      {
        id: `note-${now()}-${Math.random().toString(16).slice(2, 6)}`,
        message,
        tone,
        timestamp: now(),
      },
      ...room.notifications,
    ].slice(0, 30);
  }

  private ensureHost(room: RoomSession, playerId: string): void {
    const player = room.players.find((entry) => entry.id === playerId);
    if (!player?.isHost) {
      throw createError("UNAUTHORIZED", "Only the host can do that.");
    }
  }

  private getRoom(roomCode: string): RoomSession {
    const room = this.rooms.get(roomCode.toUpperCase());
    if (!room) {
      throw createError("ROOM_EXPIRED", "That room has already expired.");
    }

    return room;
  }

  private serializeGame(room: RoomSession): PublicGameState | null {
    if (!room.game) {
      return null;
    }

    return {
      phase: room.game.phase,
      handNumber: room.game.handNumber,
      dealerId: [...room.players].sort((left, right) => left.seatIndex - right.seatIndex)[room.game.dealerIndex]?.id ?? null,
      turnPlayerId: room.game.turnPlayerId,
      declarerId: room.game.declarerId,
      trumpSuit: room.game.trumpSuit,
      bidState: room.game.bidState
        ? {
            currentBid: room.game.bidState.currentBid,
            highestBidderId: room.game.bidState.highestBidderId,
            activePlayerId: room.game.bidState.activePlayerId,
            passedPlayerIds: [...room.game.bidState.passedPlayerIds],
            order: [...room.game.bidState.order],
            history: [...room.game.bidState.history],
          }
        : null,
      currentTrick: room.game.currentTrick
        ? {
            ...room.game.currentTrick,
            cards: [...room.game.currentTrick.cards],
          }
        : null,
      completedTrickCount: room.game.completedTricks.length,
      cardsPerPlayer: room.game.cardsPerPlayer,
      calledPartners: room.game.partnerSelection
        ? {
            requiredPartners: room.game.partnerSelection.requiredPartners,
            primaryCardIds: [...room.game.partnerSelection.primaryCardIds],
            backupCardIds: [...room.game.partnerSelection.backupCardIds],
            revealedPartnerIds: [...room.game.partnerSelection.revealedPartnerIds],
          }
        : null,
      partnerCount: room.game.partnerSelection?.requiredPartners ?? (room.players.length >= 6 ? 2 : 1),
      revealedPartnerIds: room.game.partnerSelection ? [...room.game.partnerSelection.revealedPartnerIds] : [],
      score: {
        totals: { ...room.game.score.totals },
        history: [...room.game.score.history],
        lastSummary: room.game.score.lastSummary,
      },
      lastTrickWinnerId: room.game.lastTrickWinnerId,
      statusText: describeGameStatus(room.game, room.players),
      winningPlayerIds: [...room.game.winningPlayerIds],
    };
  }

  private serializePrivateState(room: RoomSession, playerId: string): PrivatePlayerState | null {
    const player = room.players.find((entry) => entry.id === playerId);
    if (!player) {
      return null;
    }

    const hand: Card[] = room.game?.hands[playerId] ? [...room.game.hands[playerId]!] : [];
    return {
      playerId,
      hand,
      legalCardIds: getLegalCardsForPlayer(room.game, playerId),
      role: getPrivateRole(room.game, playerId),
      secretNotice: getSecretNotice(room.game, playerId, room.players),
      knownPartnerIds: getKnownPartnerIds(room.game, playerId),
      knownOpponentIds: getKnownOpponentIds(room.game, playerId, room.players),
      reconnectToken: player.token,
    };
  }

  private buildSnapshot(room: RoomSession, playerId: string): RoomSnapshot {
    const publicRoom: PublicRoomState = {
      code: room.code,
      players: room.players.map((player) => ({
        id: player.id,
        name: player.name,
        seatIndex: player.seatIndex,
        isHost: player.isHost,
        isBot: player.isBot,
        isConnected: player.isConnected,
        avatarHue: player.avatarHue,
        joinedAt: player.joinedAt,
      })),
      settings: room.settings,
      notifications: [...room.notifications],
      game: this.serializeGame(room),
      exists: true,
      roomStatus: "active",
      minPlayers: MIN_PLAYERS,
      maxPlayers: MAX_PLAYERS,
      createdAt: room.createdAt,
    };

    return {
      room: publicRoom,
      me: this.serializePrivateState(room, playerId),
    };
  }

  private publishRoomState(room: RoomSession): void {
    this.publishRoom(room);
    this.scheduleSmartBotTurn(room.code);
  }

  private clearBotTimer(roomCode: string): void {
    const timer = this.botTimers.get(roomCode);
    if (timer) {
      clearTimeout(timer);
      this.botTimers.delete(roomCode);
    }
  }

  private getPendingBotActorId(room: RoomSession): string | null {
    if (!room.game) {
      return null;
    }

    let actorId: string | null = null;
    switch (room.game.phase) {
      case "bidding":
        actorId = room.game.bidState?.activePlayerId ?? null;
        break;
      case "partner-selection":
      case "trump-selection":
      case "trick-play":
        actorId = room.game.turnPlayerId;
        break;
      default:
        actorId = null;
    }

    if (!actorId) {
      return null;
    }

    return room.players.find((player) => player.id === actorId && player.isBot)?.id ?? null;
  }

  private scheduleSmartBotTurn(roomCode: string): void {
    this.clearBotTimer(roomCode);
    const room = this.rooms.get(roomCode);
    if (!room) {
      return;
    }

    const actorId = this.getPendingBotActorId(room);
    if (!actorId) {
      return;
    }

    const timer = setTimeout(() => {
      this.clearBotTimer(roomCode);
      this.runSmartBotTurn(roomCode, actorId);
    }, BOT_ACTION_DELAY_MS);

    this.botTimers.set(roomCode, timer);
  }

  private runSmartBotTurn(roomCode: string, playerId: string): void {
    const room = this.rooms.get(roomCode);
    if (!room?.game) {
      return;
    }

    const bot = room.players.find((player) => player.id === playerId && player.isBot);
    if (!bot) {
      return;
    }

    const actorId = this.getPendingBotActorId(room);
    if (actorId !== playerId) {
      return;
    }

    try {
      switch (room.game.phase) {
        case "bidding":
          this.submitBid(roomCode, playerId, chooseSmartBotBid(room.game, playerId));
          break;
        case "partner-selection":
          this.selectPartners(roomCode, playerId, chooseSmartBotPartners(room.game, playerId));
          break;
        case "trump-selection":
          this.selectTrump(roomCode, playerId, chooseSmartBotTrump(room.game, playerId));
          break;
        case "trick-play":
          this.playCard(roomCode, playerId, chooseSmartBotCard(room.game, room.players, playerId));
          break;
        default:
          break;
      }
    } catch (error) {
      const detail =
        typeof error === "object" && error !== null && "message" in error
          ? String((error as { message?: unknown }).message)
          : "An unexpected decision failed.";
      this.addNotification(room, `${bot.name} paused after a smart-bot error: ${detail}`, "warning");
      this.publishRoom(room);
    }
  }
}
