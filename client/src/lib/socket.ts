import { io, type Socket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents } from "@kari-teeri/shared";

const defaultServerUrl = import.meta.env.PROD ? window.location.origin : "http://localhost:3001";
const serverUrl = import.meta.env.VITE_SERVER_URL ?? defaultServerUrl;

export const socket: Socket<ServerToClientEvents, ClientToServerEvents> = io(serverUrl, {
  autoConnect: false,
  transports: ["websocket"],
});
