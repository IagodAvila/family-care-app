export const focusableSelector = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

type DialogKeyboardEvent = {
  key: string;
  shiftKey: boolean;
  preventDefault: () => void;
};

type BackdropEvent = {
  target: EventTarget;
  currentTarget: EventTarget;
};

export function getFocusableElements(container: ParentNode): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(focusableSelector)).filter((element) => (
    element.getAttribute("aria-hidden") !== "true"
    && !element.hasAttribute("hidden")
  ));
}

export function trapDialogFocus(
  event: DialogKeyboardEvent,
  container: HTMLElement,
  activeElement: Element | null = container.ownerDocument.activeElement,
): boolean {
  if (event.key !== "Tab") return false;
  const focusable = getFocusableElements(container);
  if (!focusable.length) {
    event.preventDefault();
    container.focus();
    return true;
  }

  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && (activeElement === first || activeElement === container)) {
    event.preventDefault();
    last.focus();
    return true;
  }
  if (!event.shiftKey && activeElement === last) {
    event.preventDefault();
    first.focus();
    return true;
  }
  return false;
}

export function lockDocumentScroll(documentObject: Document): () => void {
  const previousOverflow = documentObject.body.style.overflow;
  documentObject.body.style.overflow = "hidden";
  return () => {
    documentObject.body.style.overflow = previousOverflow;
  };
}

export function isDirectBackdropClick(event: BackdropEvent): boolean {
  return event.target === event.currentTarget;
}
