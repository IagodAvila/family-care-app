"use client";

import { Modal } from "./modal";

type ConfirmDialogProps = {
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: "default" | "danger";
  titleId: string;
  onCancel: () => void;
  onConfirm: () => void;
};

/** Reusable in-app replacement for `window.confirm`, built on top of `Modal`. */
export function ConfirmDialog({
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancelar",
  tone = "default",
  titleId,
  onCancel,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <Modal
      className="confirm-dialog"
      titleId={titleId}
      initialFocusSelector="[data-modal-primary]"
      onClose={onCancel}
    >
      <h2 id={titleId}>{title}</h2>
      <p>{description}</p>
      <div className="form-actions">
        <button
          data-modal-primary={tone === "danger" || undefined}
          type="button"
          onClick={onCancel}
        >
          {cancelLabel}
        </button>
        <button
          className={tone === "danger" ? "submit-button danger-button" : "submit-button"}
          data-modal-primary={tone === "danger" ? undefined : true}
          type="button"
          onClick={onConfirm}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
