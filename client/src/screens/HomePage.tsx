import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CopyPlus, LogIn, Sparkles, Users } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useGameSession } from "@/hooks/useGameSession";
import { getStoredName, setStoredName } from "@/lib/storage";

const validateName = (name: string): string | null => {
  if (!name.trim()) {
    return "Enter your name before opening a table.";
  }

  if (name.trim().length < 2) {
    return "Names should be at least two characters.";
  }

  return null;
};

const validateRoomCode = (roomCode: string): string | null => {
  if (!/^[A-Z0-9]{6}$/.test(roomCode)) {
    return "Room codes are six uppercase letters or numbers.";
  }

  return null;
};

export const HomePage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { createRoom, joinRoom, error, clearError, pending } = useGameSession();
  const [name, setName] = useState(() => getStoredName());
  const [roomCode, setRoomCode] = useState(() => searchParams.get("room")?.toUpperCase() ?? "");
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    const nextRoomCode = searchParams.get("room");
    if (nextRoomCode) {
      setRoomCode(nextRoomCode.toUpperCase());
    }
  }, [searchParams]);

  const visibleError = localError ?? error?.message ?? null;

  const statCards = useMemo(
    () => [
      { icon: Sparkles, label: "Premium Table", value: "Animated felt, luxury cards, polished motion" },
      { icon: Users, label: "Multiplayer", value: "Live rooms, invite links, host controls, reconnects" },
      { icon: LogIn, label: "Rules Engine", value: "Server-authoritative Kari Teeri bidding and trick play" },
    ],
    [],
  );

  const handleCreate = async () => {
    clearError();
    const validationError = validateName(name);
    if (validationError) {
      setLocalError(validationError);
      return;
    }

    const nextName = name.trim();
    setStoredName(nextName);
    setLocalError(null);

    const response = await createRoom(nextName);
    if (response.ok) {
      navigate(`/room/${response.data.roomCode}`);
    }
  };

  const handleJoin = async () => {
    clearError();
    const nameError = validateName(name);
    const codeError = validateRoomCode(roomCode.toUpperCase());

    if (nameError || codeError) {
      setLocalError(nameError ?? codeError);
      return;
    }

    const nextName = name.trim();
    const nextCode = roomCode.toUpperCase();
    setStoredName(nextName);
    setLocalError(null);

    const response = await joinRoom(nextCode, nextName);
    if (response.ok) {
      navigate(`/room/${response.data.roomCode}`);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-hero-grid bg-[length:72px_72px] opacity-[0.06]" />
      <div className="pointer-events-none absolute -left-32 top-8 h-80 w-80 rounded-full bg-felt-700/30 blur-3xl" />
      <div className="pointer-events-none absolute right-0 top-0 h-[22rem] w-[22rem] rounded-full bg-gold-300/10 blur-3xl" />

      <main className="relative mx-auto flex min-h-screen max-w-7xl flex-col justify-center gap-10 px-5 py-12 lg:grid lg:grid-cols-[1.15fr_0.85fr] lg:items-center lg:px-8">
        <section className="max-w-2xl">
          <Badge tone="gold" className="mb-5">
            Multiplayer Trick-Taking Card Game
          </Badge>
          <motion.h1
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            className="font-display text-6xl leading-[0.95] text-white sm:text-7xl lg:text-8xl"
          >
            Kari Teeri
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            className="mt-6 max-w-xl text-lg leading-8 text-slate-300"
          >
            A rich live-table take on the classic Kali Teeri ruleset, built for shared rooms, tense bidding,
            secret partners, and beautifully animated trick play.
          </motion.p>

          <div className="mt-10 grid gap-3 sm:grid-cols-3">
            {statCards.map(({ icon: Icon, label, value }, index) => (
              <motion.div
                key={label}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.12 + index * 0.06 }}
                className="glass rounded-[1.8rem] border border-white/10 p-4 shadow-glow"
              >
                <Icon className="mb-3 h-5 w-5 text-gold-200" />
                <p className="text-sm font-semibold text-white">{label}</p>
                <p className="mt-1 text-sm leading-6 text-slate-400">{value}</p>
              </motion.div>
            ))}
          </div>
        </section>

        <motion.section
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass relative overflow-hidden rounded-[2rem] border border-white/10 p-6 shadow-glow sm:p-8"
        >
          <div className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-gold-200/35 to-transparent" />
          <div className="pointer-events-none absolute right-4 top-4 h-40 w-28 rotate-12 rounded-[1.5rem] border border-white/10 bg-white/5 shadow-glow" />
          <div className="pointer-events-none absolute right-16 top-10 h-40 w-28 -rotate-12 rounded-[1.5rem] border border-white/10 bg-white/5 shadow-glow" />

          <div className="relative z-10">
            <p className="text-[11px] uppercase tracking-[0.28em] text-gold-200/80">Enter the Salon</p>
            <h2 className="mt-3 font-display text-4xl text-white">Take a seat at the table</h2>
            <p className="mt-2 text-sm leading-6 text-slate-300">
              Your name is remembered locally, and the same reconnect token lets you reclaim your seat after a refresh.
            </p>

            <div className="mt-8 space-y-6">
              <label className="block space-y-2">
                <span className="text-sm font-medium text-slate-200">Player name</span>
                <input
                  value={name}
                  onChange={(event) => {
                    setName(event.target.value);
                    setStoredName(event.target.value);
                    setLocalError(null);
                  }}
                  placeholder="Ayesha"
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-gold-200/40"
                />
              </label>

              <Button fullWidth onClick={handleCreate} disabled={pending}>
                <CopyPlus className="h-4 w-4" />
                Create Room
              </Button>

              <div className="relative py-1 text-center text-xs uppercase tracking-[0.28em] text-slate-500">
                <span className="bg-transparent px-3">or join an existing room</span>
              </div>

              <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                <input
                  value={roomCode}
                  onChange={(event) => {
                    setRoomCode(event.target.value.toUpperCase());
                    setLocalError(null);
                  }}
                  placeholder="ROOM42"
                  maxLength={6}
                  className="w-full rounded-2xl border border-white/10 bg-slate-950/50 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-gold-200/40"
                />
                <Button onClick={handleJoin} disabled={pending}>
                  Join Room
                </Button>
              </div>
            </div>

            <AnimatePresence mode="wait">
              {visibleError ? (
                <motion.div
                  key={visibleError}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className="mt-5 rounded-2xl border border-rose-300/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100"
                >
                  {visibleError}
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        </motion.section>
      </main>
    </div>
  );
};
