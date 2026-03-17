export interface StoredSession {
  roomCode: string;
  playerId: string;
  reconnectToken: string;
  name: string;
}

const NAME_KEY = "kari-teeri:name";
const SESSION_KEY = "kari-teeri:session";

export const getStoredName = (): string => localStorage.getItem(NAME_KEY) ?? "";

export const setStoredName = (name: string): void => {
  localStorage.setItem(NAME_KEY, name);
};

export const getStoredSession = (): StoredSession | null => {
  const rawValue = localStorage.getItem(SESSION_KEY);
  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue) as StoredSession;
  } catch {
    localStorage.removeItem(SESSION_KEY);
    return null;
  }
};

export const setStoredSession = (session: StoredSession): void => {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
};

export const clearStoredSession = (): void => {
  localStorage.removeItem(SESSION_KEY);
};
