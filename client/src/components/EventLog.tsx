import type { RoomNotification } from "@kari-teeri/shared";
import { cn } from "@/utils/cn";

interface EventLogProps {
  notifications: RoomNotification[];
}

export const EventLog = ({ notifications }: EventLogProps) => (
  <div className="glass rounded-[1.7rem] border border-white/10 p-4 shadow-glow">
    <div className="mb-4">
      <p className="text-[11px] uppercase tracking-[0.24em] text-gold-200/80">Event Log</p>
      <p className="text-sm text-slate-300">Live room activity and hand updates.</p>
    </div>
    <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
      {notifications.map((item) => (
        <div
          key={item.id}
          className={cn(
            "rounded-2xl border px-3 py-2 text-sm",
            item.tone === "success" && "border-emerald-400/15 bg-emerald-400/8 text-emerald-100",
            item.tone === "warning" && "border-amber-300/15 bg-amber-300/8 text-amber-100",
            item.tone === "neutral" && "border-white/8 bg-white/5 text-slate-200",
          )}
        >
          {item.message}
        </div>
      ))}
    </div>
  </div>
);
