"use client";

import {
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  useEffect,
  useRef,
} from "react";
import { createPortal } from "react-dom";
import {
  getFocusableElements,
  isDirectBackdropClick,
  lockDocumentScroll,
  trapDialogFocus,
} from "@/lib/dialog-behavior.mjs";

type ModalProps = {
  children: ReactNode;
  className?: string;
  initialFocusSelector?: string;
  onClose: () => void;
  titleId: string;
};

export function Modal({
  children,
  className = "",
  initialFocusSelector,
  onClose,
  titleId,
}: ModalProps) {
  const dialogRef = useRef<HTMLElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    openerRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const restoreScroll = lockDocumentScroll(document);
    const app = document.querySelector<HTMLElement>(".app");
    const wasInert = app?.inert ?? false;
    const previousAriaHidden = app?.getAttribute("aria-hidden");

    if (app) {
      app.inert = true;
      app.setAttribute("aria-hidden", "true");
    }

    const animationFrame = window.requestAnimationFrame(() => {
      const requestedTarget = initialFocusSelector
        ? dialog.querySelector<HTMLElement>(initialFocusSelector)
        : null;
      const firstFocusable = getFocusableElements(dialog)[0] as HTMLElement | undefined;
      const target = requestedTarget ?? firstFocusable ?? dialog;
      target.focus();
    });

    return () => {
      window.cancelAnimationFrame(animationFrame);
      restoreScroll();

      if (app) {
        app.inert = wasInert;
        if (previousAriaHidden == null) app.removeAttribute("aria-hidden");
        else app.setAttribute("aria-hidden", previousAriaHidden);
      }

      openerRef.current?.focus();
    };
  }, [initialFocusSelector]);

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onClose();
      return;
    }

    if (dialogRef.current) {
      trapDialogFocus(event, dialogRef.current);
    }
  }

  function handleBackdropMouseDown(event: MouseEvent<HTMLDivElement>) {
    if (isDirectBackdropClick(event)) onClose();
  }

  return createPortal(
    <div className="modal-backdrop" onMouseDown={handleBackdropMouseDown}>
      <section
        className={`modal ${className}`.trim()}
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
      >
        {children}
      </section>
    </div>,
    document.body,
  );
}
