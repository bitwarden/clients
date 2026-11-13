/**
 * Shared bookkeeping for overlays (dialogs, drawers, menus, popovers): keyboard dispatch to the
 * topmost overlay and the stack of open modal dialogs.
 */

export type OverlayRegistration = {
  /** Receives keydowns while this is the topmost overlay. Return `true` if consumed. */
  onKeydown?: (event: KeyboardEvent) => boolean;
};

const overlays: OverlayRegistration[] = [];

const dispatchKeydown = (event: KeyboardEvent) => {
  // A nested widget (e.g. an open listbox inside a dialog) already handled the key.
  if (event.defaultPrevented) {
    return;
  }
  overlays.at(-1)?.onKeydown?.(event);
};

/**
 * Adds an overlay to the top of the stack. Like the CDK's overlay keyboard dispatcher, only the
 * topmost overlay receives keydowns, so Escape closes a menu before the dialog that contains it.
 * Returns the unregister function.
 */
export function registerOverlay(overlay: OverlayRegistration): () => void {
  if (overlays.length === 0) {
    document.addEventListener("keydown", dispatchKeydown);
  }
  overlays.push(overlay);
  return () => {
    const index = overlays.indexOf(overlay);
    if (index >= 0) {
      overlays.splice(index, 1);
    }
    if (overlays.length === 0) {
      document.removeEventListener("keydown", dispatchKeydown);
    }
  };
}

const modals: HTMLElement[] = [];
const modalListeners = new Set<() => void>();

/** @internal Called by the dialog container when a modal `<dialog>` opens or closes. */
export function setModalOpen(dialog: HTMLElement, open: boolean) {
  const index = modals.indexOf(dialog);
  if (open && index < 0) {
    modals.push(dialog);
  } else if (!open && index >= 0) {
    modals.splice(index, 1);
  }
  modalListeners.forEach((listener) => listener());
}

/** Runs `listener` whenever a modal dialog opens or closes. Returns an unsubscribe function. */
export function onModalStackChange(listener: () => void): () => void {
  modalListeners.add(listener);
  return () => modalListeners.delete(listener);
}

/**
 * Where to append document-level overlays (toasts, spotlight, tooltips, live regions). While a
 * modal `<dialog>` is open, everything outside it is inert, so overlays must live inside the
 * topmost one.
 */
export function getOverlayRoot(): HTMLElement {
  return modals.at(-1) ?? document.body;
}

/** Shows a `popover="manual"` element, re-showing it so it moves to the top of the top layer. */
export function raisePopover(el: HTMLElement) {
  if (el.matches(":popover-open")) {
    el.hidePopover();
  }
  el.showPopover();
}

/** Styles that neutralize the UA `[popover]` defaults for positioned top-layer panels. */
export const popoverResetCss = `
  position: fixed;
  inset: auto;
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  overflow: visible;
  color: inherit;
`;
