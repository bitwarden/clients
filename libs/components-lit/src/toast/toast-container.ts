import { css, html, PropertyValues, unsafeCSS } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { repeat } from "lit/directives/repeat.js";

import { BitElement } from "../core/bit-element";
import { t } from "../core/i18n";
import { announce } from "../core/live-announcer";
import { getOverlayRoot, onModalStackChange, popoverResetCss, raisePopover } from "../core/overlay";

import "./toast";
import type { ToastVariant } from "./toast";

export type ToastPosition = "top-right" | "top-full-width" | "bottom-full-width";

export type ToastOptions = {
  message: string | string[];
  variant?: ToastVariant;
  title?: string;
  /** Duration in ms. Defaults to `calculateToastTimeout(message)`. */
  timeout?: number;
};

type ActiveToast = {
  id: number;
  options: ToastOptions;
  progress: number;
  duration: number;
  hideTime: number;
  timer?: ReturnType<typeof setTimeout>;
  removing: boolean;
};

const FADE_MS = 300;
let nextId = 0;

/**
 * Where toasts render. Add one to the app root to configure placement and limits; otherwise one is
 * created on the first `showToast()`. Rendered in the top layer, and moved into the topmost modal
 * dialog while one is open so toasts stay interactive.
 */
@customElement("bit-toast-container")
export class BitToastContainer extends BitElement {
  static styles = [
    BitElement.styles,
    css`
      :host {
        ${unsafeCSS(popoverResetCss)}
        pointer-events: none;
        display: flex;
        flex-direction: column;
        gap: 0;
      }
      :host(:not(:popover-open)) {
        display: none;
      }
      :host([position="top-right"]) {
        inset: 12px 12px auto auto;
      }
      :host([position="top-full-width"]) {
        inset: var(--bit-toast-top, 4.3rem) 0 auto 0;
        width: 100%;
      }
      :host([position="bottom-full-width"]) {
        inset: auto 0 0 0;
        width: 100%;
      }
      .toast {
        display: block;
        width: var(--bit-toast-width, 19rem);
        transition: opacity ${FADE_MS}ms ease-in;
        /* Needed for hover states in Electron, where toasts appear in the draggable region. */
        -webkit-app-region: no-drag;
      }
      @starting-style {
        .toast {
          opacity: 0;
        }
      }
      .toast[data-removing] {
        opacity: 0;
      }
      :host([position="top-full-width"]) .toast {
        width: 96%;
        margin-inline: auto;
      }
      :host([position="bottom-full-width"]) .toast {
        width: var(--bit-toast-width-full, 96%);
        margin-inline: auto;
      }
    `,
  ];

  @property({ reflect: true }) position: ToastPosition = "top-right";

  /** Oldest toasts are dismissed beyond this many. */
  @property({ type: Number, attribute: "max-opened" }) maxOpened = 5;

  /** Time in ms a toast stays after the pointer leaves it. */
  @property({ type: Number, attribute: "extended-timeout" }) extendedTimeout = 2000;

  @state() private toasts: ActiveToast[] = [];

  private frame = 0;
  private home?: Node;
  private unsubscribeModals?: () => void;

  connectedCallback() {
    super.connectedCallback();
    containers.add(this);
    this.setAttribute("popover", "manual");
    this.unsubscribeModals ??= onModalStackChange(() => this.rehome());
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    containers.delete(this);
  }

  /** @internal */
  add(options: ToastOptions, duration: number) {
    const toast: ActiveToast = {
      id: nextId++,
      options,
      progress: 100,
      duration,
      hideTime: 0,
      removing: false,
    };
    // Newest on top.
    this.toasts = [toast, ...this.toasts];
    const visible = this.toasts.filter((item) => !item.removing);
    visible.slice(this.maxOpened).forEach((item) => this.dismissToast(item));
    this.start(toast, duration);

    const variant = options.variant ?? "info";
    const text = [t(variant), options.title, ...[options.message].flat()].filter(Boolean).join(" ");
    announce(text, variant === "error" ? "assertive" : "polite");

    this.rehome();
  }

  private start(toast: ActiveToast, duration: number) {
    clearTimeout(toast.timer);
    toast.duration = duration;
    toast.hideTime = Date.now() + duration;
    toast.timer = setTimeout(() => this.dismissToast(toast), duration);
    this.tick();
  }

  private tick = () => {
    cancelAnimationFrame(this.frame);
    const now = Date.now();
    let active = false;
    for (const toast of this.toasts) {
      if (toast.timer && !toast.removing) {
        toast.progress = Math.max(0, ((toast.hideTime - now) / toast.duration) * 100);
        active = true;
      }
    }
    this.requestUpdate();
    if (active) {
      this.frame = requestAnimationFrame(this.tick);
    }
  };

  private dismissToast(toast: ActiveToast) {
    if (toast.removing) {
      return;
    }
    clearTimeout(toast.timer);
    toast.timer = undefined;
    toast.removing = true;
    this.requestUpdate();
    setTimeout(() => {
      this.toasts = this.toasts.filter((item) => item !== toast);
    }, FADE_MS);
  }

  private stickAround(toast: ActiveToast) {
    clearTimeout(toast.timer);
    toast.timer = undefined;
    toast.progress = 0;
    this.requestUpdate();
  }

  private delayedHide(toast: ActiveToast) {
    if (!toast.removing && this.extendedTimeout > 0) {
      this.start(toast, this.extendedTimeout);
    }
  }

  /** Moves into the topmost modal dialog (outside it everything is inert) and to the top layer's top. */
  private rehome() {
    const root = getOverlayRoot();
    const intoModal = root !== document.body && this.toasts.length > 0;
    const target = intoModal ? root : this.home;
    if (target && this.parentNode !== target) {
      if (intoModal) {
        this.home ??= this.parentNode ?? document.body;
      }
      target.appendChild(this);
    }
    if (!intoModal) {
      this.home = undefined;
    }
    if (this.toasts.length && this.isConnected) {
      raisePopover(this);
    }
  }

  protected updated(changed: PropertyValues) {
    super.updated(changed);
    if (changed.has("toasts") && this.toasts.length === 0 && this.matches(":popover-open")) {
      this.hidePopover();
    }
  }

  render() {
    return repeat(
      this.toasts,
      (toast) => toast.id,
      (toast) =>
        html`<bit-toast
          class="toast"
          ?data-removing=${toast.removing}
          variant=${toast.options.variant ?? "info"}
          heading=${toast.options.title ?? ""}
          .message=${toast.options.message}
          progress-width=${toast.progress}
          @mouseenter=${() => this.stickAround(toast)}
          @mouseleave=${() => this.delayedHide(toast)}
          @dismissed=${() => this.dismissToast(toast)}
        ></bit-toast>`,
    );
  }
}

const containers = new Set<BitToastContainer>();

/** @internal The app's container, created on demand. */
export function getToastContainer(): BitToastContainer {
  const existing = [...containers].at(-1);
  if (existing) {
    return existing;
  }
  const container = document.createElement("bit-toast-container");
  document.body.append(container);
  return container;
}

declare global {
  interface HTMLElementTagNameMap {
    "bit-toast-container": BitToastContainer;
  }
}
