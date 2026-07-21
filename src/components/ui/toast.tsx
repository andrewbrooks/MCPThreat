"use client";

import * as React from "react";
import { CheckCircle2, AlertCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";

type ToastVariant = "success" | "error" | "info";
interface Toast {
  id: number;
  message: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  toast: (message: string, variant?: ToastVariant) => void;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = React.useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

let idCounter = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);

  const remove = React.useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const toast = React.useCallback(
    (message: string, variant: ToastVariant = "info") => {
      const id = ++idCounter;
      setToasts((t) => [...t, { id, message, variant }]);
      setTimeout(() => remove(id), 4000);
    },
    [remove],
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={cn(
              "flex items-start gap-3 rounded-md border p-3 text-sm shadow-lg bg-card",
              t.variant === "success" && "border-emerald-500/40",
              t.variant === "error" && "border-red-500/40",
              t.variant === "info" && "border-border",
            )}
            role="status"
          >
            {t.variant === "success" && (
              <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-400" />
            )}
            {t.variant === "error" && (
              <AlertCircle className="mt-0.5 size-4 shrink-0 text-red-400" />
            )}
            <span className="flex-1">{t.message}</span>
            <button onClick={() => remove(t.id)} aria-label="Dismiss">
              <X className="size-4 opacity-60 hover:opacity-100" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
