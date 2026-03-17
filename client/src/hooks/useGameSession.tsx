import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { PropsWithChildren } from "react";
import type {
  AckResponse,
  AppError,
  BidActionInput,
  JoinRoomResult,
  PartnerSelectionInput,
  PlayCardInput,
  RoomExpiredEvent,
  RoomSnapshot,
  Suit,
  UpdateSettingsInput,
} from "@kari-teeri/shared";
import { socket } from "@/lib/socket";
import { clearStoredSession, getStoredSession, setStoredName, setStoredSession, type StoredSession } from "@/lib/storage";

type ActionResponse<T> = Promise<AckResponse<T>>;

interface GameSessionContextValue {
  snapshot: RoomSnapshot | null;
  session: StoredSession | null;
  error: AppError | null;
  expired: RoomExpiredEvent | null;
  connected: boolean;
  pending: boolean;
  createRoom: (name: string) => ActionResponse<JoinRoomResult>;
  joinRoom: (roomCode: string, name: string) => ActionResponse<JoinRoomResult>;
  reconnectRoom: (roomCode: string, reconnectToken: string) => ActionResponse<JoinRoomResult>;
  leaveRoom: () => ActionResponse<undefined>;
  updateSettings: (payload: UpdateSettingsInput) => ActionResponse<undefined>;
  addSmartBot: () => ActionResponse<undefined>;
  removeSmartBot: (botPlayerId?: string) => ActionResponse<undefined>;
  startGame: () => ActionResponse<undefined>;
  submitBid: (payload: BidActionInput) => ActionResponse<undefined>;
  selectPartners: (payload: PartnerSelectionInput) => ActionResponse<undefined>;
  selectTrump: (suit: Suit) => ActionResponse<undefined>;
  playCard: (payload: PlayCardInput) => ActionResponse<undefined>;
  continueGame: () => ActionResponse<undefined>;
  returnToLobby: () => ActionResponse<undefined>;
  clearError: () => void;
  clearExpired: () => void;
}

const GameSessionContext = createContext<GameSessionContextValue | null>(null);

const ensureConnected = async (): Promise<void> => {
  if (socket.connected) {
    return;
  }

  socket.connect();

  await new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(() => {
      cleanup();
      reject(new Error("Connection timed out."));
    }, 5000);

    const onConnect = () => {
      cleanup();
      resolve();
    };

    const onError = () => {
      cleanup();
      reject(new Error("Could not connect to the server."));
    };

    const cleanup = () => {
      window.clearTimeout(timer);
      socket.off("connect", onConnect);
      socket.off("connect_error", onError);
    };

    socket.on("connect", onConnect);
    socket.on("connect_error", onError);
  });
};

export const GameSessionProvider = ({ children }: PropsWithChildren) => {
  const [snapshot, setSnapshot] = useState<RoomSnapshot | null>(null);
  const [session, setSession] = useState<StoredSession | null>(() => getStoredSession());
  const [error, setError] = useState<AppError | null>(null);
  const [expired, setExpired] = useState<RoomExpiredEvent | null>(null);
  const [connected, setConnected] = useState<boolean>(socket.connected);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    const handleConnect = () => setConnected(true);
    const handleDisconnect = () => setConnected(false);
    const handleRoomState = (nextSnapshot: RoomSnapshot) => {
      setSnapshot(nextSnapshot);
      setExpired(null);

      if (nextSnapshot.me) {
        const name = nextSnapshot.room.players.find((player) => player.id === nextSnapshot.me?.playerId)?.name ?? session?.name ?? "";
        const nextSession = {
          roomCode: nextSnapshot.room.code,
          playerId: nextSnapshot.me.playerId,
          reconnectToken: nextSnapshot.me.reconnectToken,
          name,
        };
        setSession(nextSession);
        setStoredSession(nextSession);
      }
    };

    const handleRoomError = (nextError: AppError) => {
      setError(nextError);
    };

    const handleExpired = (payload: RoomExpiredEvent) => {
      setExpired(payload);
      if (session?.roomCode === payload.roomCode) {
        clearStoredSession();
        setSession(null);
        setSnapshot(null);
      }
    };

    socket.on("connect", handleConnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("room:state", handleRoomState);
    socket.on("room:error", handleRoomError);
    socket.on("room:expired", handleExpired);

    return () => {
      socket.off("connect", handleConnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("room:state", handleRoomState);
      socket.off("room:error", handleRoomError);
      socket.off("room:expired", handleExpired);
    };
  }, [session?.name, session?.roomCode]);

  const runAction = async <T,>(runner: () => Promise<AckResponse<T>>): Promise<AckResponse<T>> => {
    try {
      setPending(true);
      setError(null);
      const response = await runner();
      if (!response.ok) {
        setError(response.error);
      }
      return response;
    } finally {
      setPending(false);
    }
  };

  const emitWithAck = <T,>(emit: (callback: (response: AckResponse<T>) => void) => void): Promise<AckResponse<T>> =>
    new Promise((resolve) => {
      emit(resolve);
    });

  const createRoom = (name: string) =>
    runAction(async () => {
      await ensureConnected();
      setStoredName(name);
      const response = await emitWithAck<JoinRoomResult>((callback) =>
        socket.emit("room:create", { name, token: session?.reconnectToken ?? null }, callback),
      );

      if (response.ok) {
        const nextSession = {
          roomCode: response.data.roomCode,
          playerId: response.data.playerId,
          reconnectToken: response.data.reconnectToken,
          name,
        };
        setSession(nextSession);
        setStoredSession(nextSession);
      }

      return response;
    });

  const joinRoom = (roomCode: string, name: string) =>
    runAction(async () => {
      await ensureConnected();
      setStoredName(name);
      const response = await emitWithAck<JoinRoomResult>((callback) =>
        socket.emit("room:join", { roomCode, name, token: session?.roomCode === roomCode ? session.reconnectToken : null }, callback),
      );

      if (response.ok) {
        const nextSession = {
          roomCode: response.data.roomCode,
          playerId: response.data.playerId,
          reconnectToken: response.data.reconnectToken,
          name,
        };
        setSession(nextSession);
        setStoredSession(nextSession);
      }

      return response;
    });

  const reconnectRoom = (roomCode: string, reconnectToken: string) =>
    runAction(async () => {
      await ensureConnected();
      const response = await emitWithAck<JoinRoomResult>((callback) =>
        socket.emit("room:reconnect", { roomCode, token: reconnectToken }, callback),
      );

      if (response.ok) {
        const nextSession = {
          roomCode: response.data.roomCode,
          playerId: response.data.playerId,
          reconnectToken: response.data.reconnectToken,
          name: session?.name ?? "",
        };
        setSession(nextSession);
        setStoredSession(nextSession);
      } else if (response.error.code === "ROOM_EXPIRED") {
        clearStoredSession();
        setSession(null);
      }

      return response;
    });

  const leaveRoom = () =>
    runAction(async () => {
      await ensureConnected();
      const response = await emitWithAck<undefined>((callback) => socket.emit("room:leave", callback));
      if (response.ok) {
        clearStoredSession();
        setSession(null);
        setSnapshot(null);
      }
      return response;
    });

  const updateSettings = (payload: UpdateSettingsInput) =>
    runAction(async () => {
      await ensureConnected();
      return emitWithAck<undefined>((callback) => socket.emit("room:update-settings", payload, callback));
    });

  const addSmartBot = () =>
    runAction(async () => {
      await ensureConnected();
      return emitWithAck<undefined>((callback) => socket.emit("room:add-smart-bot", callback));
    });

  const removeSmartBot = (botPlayerId?: string) =>
    runAction(async () => {
      await ensureConnected();
      return emitWithAck<undefined>((callback) => socket.emit("room:remove-smart-bot", botPlayerId ? { botPlayerId } : {}, callback));
    });

  const startGame = () =>
    runAction(async () => {
      await ensureConnected();
      return emitWithAck<undefined>((callback) => socket.emit("game:start", callback));
    });

  const submitBid = (payload: BidActionInput) =>
    runAction(async () => {
      await ensureConnected();
      return emitWithAck<undefined>((callback) => socket.emit("game:bid", payload, callback));
    });

  const selectPartners = (payload: PartnerSelectionInput) =>
    runAction(async () => {
      await ensureConnected();
      return emitWithAck<undefined>((callback) => socket.emit("game:select-partners", payload, callback));
    });

  const selectTrump = (suit: Suit) =>
    runAction(async () => {
      await ensureConnected();
      return emitWithAck<undefined>((callback) => socket.emit("game:select-trump", { suit }, callback));
    });

  const playCard = (payload: PlayCardInput) =>
    runAction(async () => {
      await ensureConnected();
      return emitWithAck<undefined>((callback) => socket.emit("game:play-card", payload, callback));
    });

  const continueGame = () =>
    runAction(async () => {
      await ensureConnected();
      return emitWithAck<undefined>((callback) => socket.emit("game:continue", callback));
    });

  const returnToLobby = () =>
    runAction(async () => {
      await ensureConnected();
      return emitWithAck<undefined>((callback) => socket.emit("game:return-to-lobby", callback));
    });

  const value = useMemo<GameSessionContextValue>(
    () => ({
      snapshot,
      session,
      error,
      expired,
      connected,
      pending,
      createRoom,
      joinRoom,
      reconnectRoom,
      leaveRoom,
      updateSettings,
      addSmartBot,
      removeSmartBot,
      startGame,
      submitBid,
      selectPartners,
      selectTrump,
      playCard,
      continueGame,
      returnToLobby,
      clearError: () => setError(null),
      clearExpired: () => setExpired(null),
    }),
    [connected, error, expired, pending, session, snapshot],
  );

  return <GameSessionContext.Provider value={value}>{children}</GameSessionContext.Provider>;
};

export const useGameSession = () => {
  const context = useContext(GameSessionContext);
  if (!context) {
    throw new Error("useGameSession must be used inside GameSessionProvider.");
  }

  return context;
};
