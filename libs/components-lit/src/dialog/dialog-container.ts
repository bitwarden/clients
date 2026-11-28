import { css, html, nothing } from "lit";
import { customElement, query } from "lit/decorators.js";

import { BitElement } from "../core/bit-element";
import { getDeepActiveElement, trapFocus } from "../core/focus";
import { registerOverlay, setModalOpen } from "../core/overlay";

import { DialogHostController, focusInitial } from "./dialog-host";
import { DialogConfig, DialogRef } from "./dialog-ref";

let scrollLocks = 0;
let previousOverflow = "";

function lockScroll(lock: boolean) {
  if (lock && scrollLocks++ === 0) {
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
  } else if (!lock && --scrollLocks === 0) {
    document.body.style.overflow = previousOverflow;
  }
}

/**
 * Modal `<dialog>` hosting content opened with `openDialog`.
 *
 * @internal
 */
@customElement("bit-dialog-container")
export class BitDialogContainer extends BitElement {
  static styles = [
    BitElement.styles,
    css`
      dialog {
        position: fixed;
        inset: 0;
        width: 100%;
        height: 100%;
        max-width: none;
        max-height: none;
        margin: 0;
        padding: 0;
        border: 0;
        background: transparent;
        color: inherit;
        overflow: hidden;
        outline: none;
        display: flex;
        justify-content: center;
        align-items: flex-end;
      }
      dialog:not([open]) {
        display: none;
      }
      dialog.center {
        align-items: center;
      }
      @media (min-width: 768px) {
        dialog {
          align-items: center;
        }
      }
      dialog::backdrop {
        background: var(--color-bg-overlay);
        transition: opacity 0.4s cubic-bezier(0.25, 0.8, 0.25, 1);
      }
      @starting-style {
        dialog[open]::backdrop {
          opacity: 0;
        }
      }
      .pane {
        display: flex;
        flex-direction: column;
        max-width: 100%;
        max-height: 100%;
      }
    `,
  ];

  ref!: DialogRef<any, any>;

  config: DialogConfig<any, any> = {};

  @query("dialog") private dialog!: HTMLDialogElement;

  private readonly hostController = new DialogHostController(this);
  private cleanups: (() => void)[] = [];
  private restoreTarget?: HTMLElement | null;

  /** @internal */
  async openModal() {
    this.hostController.setRef(this.ref);
    this.captureRestoreFocus();
    await this.updateComplete;
    if (this.ref.isClosed) {
      return;
    }
    const dialog = this.dialog;
    dialog.showModal();
    setModalOpen(dialog, true);
    lockScroll(true);

    const onNavigate = () => this.ref._forceClose();
    if (this.config.closeOnNavigation !== false) {
      window.addEventListener("popstate", onNavigate);
      window.addEventListener("hashchange", onNavigate);
    }

    this.cleanups = [
      trapFocus(dialog),
      registerOverlay({
        onKeydown: (event) => {
          if (event.key === "Escape") {
            // Also stops the native close request, so `disableClose` can't be bypassed.
            event.preventDefault();
            if (!this.ref.disableClose) {
              void this.ref.close();
            }
          }
          return true;
        },
      }),
      () => window.removeEventListener("popstate", onNavigate),
      () => window.removeEventListener("hashchange", onNavigate),
      () => lockScroll(false),
    ];

    await focusInitial(this, dialog);
  }

  /** @internal */
  teardown() {
    this.cleanups.forEach((cleanup) => cleanup());
    this.cleanups = [];
    const dialog = this.dialog;
    if (dialog) {
      setModalOpen(dialog, false);
      if (dialog.open) {
        dialog.close();
      }
    }
    this.remove();
    if (this.restoreTarget?.isConnected) {
      this.restoreTarget.focus();
    }
  }

  /**
   * Captured now, but re-read after a tick if the element is gone: a menu item that opened this
   * dialog is removed while the menu returns focus to its trigger, which is the better target.
   */
  private captureRestoreFocus() {
    const { restoreFocus } = this.config;
    if (restoreFocus === false) {
      return;
    }
    if (restoreFocus instanceof HTMLElement) {
      this.restoreTarget = restoreFocus;
      return;
    }
    const active = getDeepActiveElement() as HTMLElement | null;
    this.restoreTarget = active;
    setTimeout(() => {
      if (!this.restoreTarget?.isConnected || !this.restoreTarget.checkVisibility()) {
        const current = getDeepActiveElement() as HTMLElement | null;
        if (current && !this.contains(current)) {
          this.restoreTarget = current;
        }
      }
    }, 0);
  }

  private onCancel = (event: Event) => {
    // Close requests that bypass keydown (e.g. Android back) still respect `disableClose`.
    event.preventDefault();
    if (!this.ref.disableClose) {
      void this.ref.close();
    }
  };

  private onClose = () => {
    // The browser closed the dialog anyway.
    if (!this.ref.isClosed) {
      this.ref._forceClose();
    }
  };

  private onBackdropClick = (event: MouseEvent) => {
    if (event.composedPath()[0] === this.dialog && !this.ref.disableClose) {
      void this.ref.close();
    }
  };

  render() {
    const { width, height, position, ariaModal } = this.config;
    const size = [width ? `width:${width}` : "", height ? `height:${height}` : ""].join(";");
    return html`<dialog
      part="dialog"
      class=${position === "center" ? "center" : ""}
      aria-modal=${ariaModal === false ? "false" : "true"}
      aria-label=${this.ref?.label || nothing}
      @cancel=${this.onCancel}
      @close=${this.onClose}
      @click=${this.onBackdropClick}
    >
      <div class="pane" style=${size}><slot></slot></div>
    </dialog>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bit-dialog-container": BitDialogContainer;
  }
}
