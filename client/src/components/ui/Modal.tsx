import type { PropsWithChildren, ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/utils/cn";

interface ModalProps {
  open: boolean;
  onClose?: () => void;
  title: string;
  description?: string;
  footer?: ReactNode;
  className?: string;
}

export const Modal = ({ open, onClose, title, description, footer, className, children }: PropsWithChildren<ModalProps>) => (
  <AnimatePresence>
    {open ? (
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-md"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          initial={{ y: 24, opacity: 0, scale: 0.98 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 18, opacity: 0, scale: 0.98 }}
          transition={{ duration: 0.22 }}
          className={cn("glass w-full max-w-2xl rounded-[2rem] border border-white/10 p-6 shadow-glow", className)}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="mb-5 space-y-2">
            <h2 className="font-display text-3xl text-white">{title}</h2>
            {description ? <p className="text-sm text-slate-300">{description}</p> : null}
          </div>
          <div>{children}</div>
          {footer ? <div className="mt-6 flex flex-wrap items-center justify-end gap-3">{footer}</div> : null}
        </motion.div>
      </motion.div>
    ) : null}
  </AnimatePresence>
);
