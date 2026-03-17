import type { Server as HttpServer } from "node:http";
import { Server } from "socket.io";
import type { AckCallback, AppError, ClientToServerEvents, ServerToClientEvents } from "@kari-teeri/shared";
import { RoomManager } from "./roomManager.js";
import { createError } from "./utils.js";

type TypedSocketServer = Server<ClientToServerEvents, ServerToClientEvents>;

const coerceError = (error: unknown): AppError =>
  typeof error === "object" && error !== null && "code" in error && "message" in error
    ? (error as AppError)
    : createError("INVALID_ACTION", "Something went wrong while processing that request.");

export const registerSocketHandlers = (httpServer: HttpServer) => {
  const io: TypedSocketServer = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  const roomManager = new RoomManager(
    (room) => {
      room.players.forEach((player) => {
        if (!player.socketId) {
          return;
        }

        const socket = io.sockets.sockets.get(player.socketId);
        if (!socket) {
          return;
        }

        socket.emit("room:state", roomManager.getSnapshot(room.code, player.id));
      });
    },
    (roomCode) => {
      io.emit("room:expired", {
        roomCode,
        message: "That room has expired.",
      });
    },
  );

  io.on("connection", (socket) => {
    const reply = <T>(callback: AckCallback<T> | undefined, response: Parameters<AckCallback<T>>[0]) => {
      if (callback) {
        callback(response);
      }
    };

    const requireSession = (): { roomCode: string; playerId: string } => {
      if (!socket.data.roomCode || !socket.data.playerId) {
        throw createError("UNAUTHORIZED", "You are not seated in a room.");
      }

      return {
        roomCode: socket.data.roomCode as string,
        playerId: socket.data.playerId as string,
      };
    };

    const setSocketSession = (roomCode: string, playerId: string) => {
      socket.data.roomCode = roomCode;
      socket.data.playerId = playerId;
      socket.join(roomCode);
    };

    const clearSocketSession = () => {
      if (socket.data.roomCode) {
        socket.leave(socket.data.roomCode as string);
      }

      socket.data.roomCode = undefined;
      socket.data.playerId = undefined;
    };

    socket.on("room:create", (payload, callback) => {
      try {
        const result = roomManager.createRoom(payload.name, payload.token ?? null, socket.id);
        setSocketSession(result.roomCode, result.playerId);
        reply(callback, { ok: true, data: result });
      } catch (error) {
        reply(callback, { ok: false, error: coerceError(error) });
      }
    });

    socket.on("room:join", (payload, callback) => {
      try {
        const result = roomManager.joinRoom(payload.roomCode, payload.name, payload.token ?? null, socket.id);
        setSocketSession(result.roomCode, result.playerId);
        reply(callback, { ok: true, data: result });
      } catch (error) {
        reply(callback, { ok: false, error: coerceError(error) });
      }
    });

    socket.on("room:reconnect", (payload, callback) => {
      try {
        const result = roomManager.reconnectRoom(payload.roomCode, payload.token, socket.id);
        setSocketSession(result.roomCode, result.playerId);
        reply(callback, { ok: true, data: result });
      } catch (error) {
        reply(callback, { ok: false, error: coerceError(error) });
      }
    });

    socket.on("room:leave", (callback) => {
      try {
        const { roomCode, playerId } = requireSession();
        roomManager.leaveRoom(roomCode, playerId);
        clearSocketSession();
        reply(callback, { ok: true, data: undefined });
      } catch (error) {
        reply(callback, { ok: false, error: coerceError(error) });
      }
    });

    socket.on("room:update-settings", (payload, callback) => {
      try {
        const { roomCode, playerId } = requireSession();
        roomManager.updateSettings(roomCode, playerId, payload);
        reply(callback, { ok: true, data: undefined });
      } catch (error) {
        reply(callback, { ok: false, error: coerceError(error) });
      }
    });

    socket.on("room:add-smart-bot", (callback) => {
      try {
        const { roomCode, playerId } = requireSession();
        roomManager.addSmartBot(roomCode, playerId);
        reply(callback, { ok: true, data: undefined });
      } catch (error) {
        reply(callback, { ok: false, error: coerceError(error) });
      }
    });

    socket.on("room:remove-smart-bot", (payload, callback) => {
      try {
        const { roomCode, playerId } = requireSession();
        roomManager.removeSmartBot(roomCode, playerId, payload);
        reply(callback, { ok: true, data: undefined });
      } catch (error) {
        reply(callback, { ok: false, error: coerceError(error) });
      }
    });

    socket.on("game:start", (callback) => {
      try {
        const { roomCode, playerId } = requireSession();
        roomManager.startGame(roomCode, playerId);
        reply(callback, { ok: true, data: undefined });
      } catch (error) {
        reply(callback, { ok: false, error: coerceError(error) });
      }
    });

    socket.on("game:bid", (payload, callback) => {
      try {
        const { roomCode, playerId } = requireSession();
        roomManager.submitBid(roomCode, playerId, payload);
        reply(callback, { ok: true, data: undefined });
      } catch (error) {
        reply(callback, { ok: false, error: coerceError(error) });
      }
    });

    socket.on("game:select-partners", (payload, callback) => {
      try {
        const { roomCode, playerId } = requireSession();
        roomManager.selectPartners(roomCode, playerId, payload);
        reply(callback, { ok: true, data: undefined });
      } catch (error) {
        reply(callback, { ok: false, error: coerceError(error) });
      }
    });

    socket.on("game:select-trump", (payload, callback) => {
      try {
        const { roomCode, playerId } = requireSession();
        roomManager.selectTrump(roomCode, playerId, payload.suit);
        reply(callback, { ok: true, data: undefined });
      } catch (error) {
        reply(callback, { ok: false, error: coerceError(error) });
      }
    });

    socket.on("game:play-card", (payload, callback) => {
      try {
        const { roomCode, playerId } = requireSession();
        roomManager.playCard(roomCode, playerId, payload.cardId);
        reply(callback, { ok: true, data: undefined });
      } catch (error) {
        reply(callback, { ok: false, error: coerceError(error) });
      }
    });

    socket.on("game:continue", (callback) => {
      try {
        const { roomCode, playerId } = requireSession();
        roomManager.continueGame(roomCode, playerId);
        reply(callback, { ok: true, data: undefined });
      } catch (error) {
        reply(callback, { ok: false, error: coerceError(error) });
      }
    });

    socket.on("game:return-to-lobby", (callback) => {
      try {
        const { roomCode, playerId } = requireSession();
        roomManager.returnToLobby(roomCode, playerId);
        reply(callback, { ok: true, data: undefined });
      } catch (error) {
        reply(callback, { ok: false, error: coerceError(error) });
      }
    });

    socket.on("disconnect", () => {
      if (socket.data.roomCode && socket.data.playerId) {
        roomManager.handleDisconnect(socket.data.roomCode as string, socket.data.playerId as string);
      }
    });
  });

  return io;
};
