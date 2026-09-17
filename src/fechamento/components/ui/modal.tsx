"use client";

import { X } from "lucide-react";
import { useEffect, useRef, useId, type ReactNode } from "react";
import { createPortal } from "react-dom";

const modalStack: string[] = [];

export function Modal({
  title,
  description,
  headerAction,
  onClose,
  children,
  size = "large",
}: {
  title: ReactNode;
  description?: string;
  headerAction?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  size?: "medium" | "large" | "fullscreen";
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const modalId = useId();
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    modalStack.push(modalId);
    const previousOverflow = document.body.style.overflow;
    const panel = panelRef.current;
    const focusable = panel?.querySelector<HTMLElement>(
      "button, input, select, textarea, a[href], [tabindex]:not([tabindex='-1'])",
    );
    focusable?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (modalStack.at(-1) !== modalId) return;
      if (event.key === "Escape") closeRef.current();
      if (event.key !== "Tab" || !panel) return;
      const items = Array.from(
        panel.querySelectorAll<HTMLElement>(
          "button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex]:not([tabindex='-1'])",
        ),
      );
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      const index = modalStack.indexOf(modalId);
      if (index >= 0) modalStack.splice(index, 1);
      document.body.style.overflow = previousOverflow;
      previous?.focus();
    };
  }, [modalId]);

  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-navy-900/45 backdrop-blur-[2px] ${size === "fullscreen" ? "p-0" : "p-3 sm:p-6"}`}
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${modalId}-title`}
        aria-describedby={description ? `${modalId}-description` : undefined}
        className={`glass-strong flex w-full flex-col overflow-hidden border border-[var(--border)] shadow-[var(--elev-3)] ${
          size === "fullscreen"
            ? "h-dvh max-h-none max-w-none rounded-none border-0"
            : `max-h-[94vh] rounded-3xl ${size === "large" ? "max-w-6xl" : "max-w-2xl"}`
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-4">
          <div className="min-w-0">
            <h2
              id={`${modalId}-title`}
              className="truncate text-lg font-bold text-[var(--foreground)]"
            >
              {title}
            </h2>
            {description && (
              <p id={`${modalId}-description`} className="mt-0.5 text-sm text-slate-500">
                {description}
              </p>
            )}
          </div>
          <div className="ml-auto flex items-center gap-3">
            {headerAction}
            <button
              type="button"
              onClick={onClose}
              className="icon-button"
              aria-label="Fechar diálogo"
            >
              <X size={19} />
            </button>
          </div>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
