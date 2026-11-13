import { css, html, unsafeCSS } from "lit";
import { customElement, property } from "lit/decorators.js";

import { BitElement } from "../core/bit-element";
import { captureFocus, getDeepActiveElement } from "../core/focus";
import { popoverResetCss, registerOverlay } from "../core/overlay";

import { DialogHostController, focusInitial, mountContent } from "./dialog-host";
import { DialogConfig, DialogContent, DrawerRef } from "./dialog-ref";

/** Width in rem for each `bit-dialog` size in a drawer; used for push-mode column widths. */
export const drawerSizeToWidthRem: Record<string, number> = {
  small: 24,
  default: 32,
  large: 42,
};

type DrawerEntry = { ref: DrawerRef<any, any>; host: BitDrawerHost };

/**
 * The drawer stack, replacing `DrawerService`. Layouts render the stack with `<bit-drawer-outlet>`
 * and read `pushWidthPx` / set `isPushMode` to decide between pushing content and overlaying it.
 */
class DrawerStack {
  private entries: DrawerEntry[] = [];
  private readonly listeners = new Set<() => void>();
  private _pushWidthPx = 0;
  private _isPushMode = false;
  private stopNavigationWatch?: () => void;

  /** Number of drawers in the stack. */
  get depth() {
    return this.entries.length;
  }

  /** Drawer hosts, bottom first. */
  get hosts(): HTMLElement[] {
    return this.entries.map((entry) => entry.host);
  }

  /** The top drawer's preferred push-mode width in px; 0 when none is open. */
  get pushWidthPx() {
    return this._pushWidthPx;
  }

  /** Whether the drawer occupies its own column. Set by the layout. */
  get isPushMode() {
    return this._isPushMode;
  }
  set isPushMode(value: boolean) {
    if (value !== this._isPushMode) {
      this._isPushMode = value;
      this.notify();
    }
  }

  /** Runs `listener` on any change. Returns an unsubscribe function. */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Called by drawer content (e.g. `bit-dialog`) to declare its natural push-mode width. */
  declarePushWidth(px: number) {
    if (px !== this._pushWidthPx) {
      this._pushWidthPx = px;
      this.notify();
    }
  }

  isTop(ref: DrawerRef<any, any>) {
    return this.entries.at(-1)?.ref === ref;
  }

  /**
   * Closes drawers top-down, stopping at one with `disableClose` or whose `closePredicate`
   * refuses. Resolves true if the whole stack closed.
   */
  async closeAll(): Promise<boolean> {
    while (this.entries.length > 0) {
      const top = this.entries[this.entries.length - 1].ref;
      if (top.disableClose) {
        return false;
      }
      const { closed } = await top.close();
      if (!closed) {
        return false;
      }
    }
    return true;
  }

  /** Clears the stack, ignoring `closePredicate`s. */
  forceCloseAll() {
    for (const { ref } of [...this.entries].reverse()) {
      ref._forceClose();
    }
  }

  /** @internal */
  push(ref: DrawerRef<any, any>, host: BitDrawerHost) {
    this.entries.push({ ref, host });
    if (this.entries.length === 1 && ref.closeOnNavigation) {
      this.stopNavigationWatch = watchPathChanges(() => this.forceCloseAll());
    }
    ensureOutlet();
    this.notify();
  }

  /** @internal */
  pop(ref: DrawerRef<any, any>) {
    const index = this.entries.findIndex((entry) => entry.ref === ref);
    if (index < 0) {
      return;
    }
    const [{ host }] = this.entries.splice(index, 1);
    if (this.entries.length === 0) {
      this.stopNavigationWatch?.();
      this.stopNavigationWatch = undefined;
      this._pushWidthPx = 0;
      this._isPushMode = false;
    }
    // Reveal the drawer underneath first, so focus can return into it.
    this.notify();
    host.teardown();
  }

  private notify() {
    this.listeners.forEach((listener) => listener());
  }
}

export const drawerStack = new DrawerStack();

/** Calls `onChange` when the path changes, via history traversal or the Navigation API. */
function watchPathChanges(onChange: () => void): () => void {
  let path = location.pathname;
  const check = () => {
    if (location.pathname !== path) {
      path = location.pathname;
      onChange();
    }
  };
  const navigation = (window as Window & { navigation?: EventTarget }).navigation;
  window.addEventListener("popstate", check);
  navigation?.addEventListener("navigatesuccess", check);
  return () => {
    window.removeEventListener("popstate", check);
    navigation?.removeEventListener("navigatesuccess", check);
  };
}

/**
 * Opens `content` in the side drawer, replacing any open drawer stack. Resolves `undefined` if a
 * drawer in the stack refused to close. Use `DrawerRef.stack()` to push on top instead.
 */
export async function openDrawer<R = unknown, D = unknown>(
  content: DialogContent<R, D>,
  config: Omit<DialogConfig<D, R>, "position" | "ariaModal"> = {},
): Promise<DrawerRef<R, D> | undefined> {
  if (!(await drawerStack.closeAll())) {
    return undefined;
  }
  return stackDrawer(content, config, config.closeOnNavigation ?? false);
}

function stackDrawer<R, D>(
  content: DialogContent<R, D>,
  config: Omit<DialogConfig<D, R>, "position" | "ariaModal">,
  closeOnNavigation: boolean,
): DrawerRef<R, D> {
  const host = document.createElement("bit-drawer-host");
  const ref: DrawerRef<R, D> = new DrawerRef<R, D>({
    data: config.data as D,
    disableClose: config.disableClose,
    closePredicate: config.closePredicate,
    closeOnNavigation,
    onClose: () => drawerStack.pop(ref),
    isTop: () => drawerStack.isTop(ref),
    stack: (next, nextConfig) => stackDrawer(next, nextConfig ?? {}, false),
  });
  host.ref = ref;
  host.restoreFocusOnClose = config.restoreFocus !== false;
  ref.content = mountContent(host, content, ref);
  drawerStack.push(ref, host);
  return ref;
}

/**
 * Hosts one drawer's content.
 *
 * @internal
 */
@customElement("bit-drawer-host")
export class BitDrawerHost extends BitElement {
  static styles = [
    BitElement.styles,
    css`
      :host {
        display: flex;
        flex-direction: column;
        height: 100%;
      }
      :host([hidden]) {
        display: none;
      }
    `,
  ];

  ref!: DrawerRef<any, any>;

  restoreFocusOnClose = true;

  private readonly hostController = new DialogHostController(this);
  private restoreFocus?: () => void;
  private unregister?: () => void;
  private opened = false;

  connectedCallback() {
    super.connectedCallback();
    if (this.opened) {
      return;
    }
    this.opened = true;
    this.hostController.setRef(this.ref);
    this.restoreFocus = captureFocus();
    // For drawers, Escape mirrors the back button and pops only this entry.
    this.unregister = registerOverlay({
      onKeydown: (event) => {
        const active = getDeepActiveElement();
        if (event.key !== "Escape" || !active || !this.containsDeep(active)) {
          return false;
        }
        event.preventDefault();
        if (!this.ref.disableClose) {
          void this.ref.close();
        }
        return true;
      },
    });
    void this.updateComplete.then(() => focusInitial(this, this));
  }

  /** @internal */
  teardown() {
    this.unregister?.();
    const active = getDeepActiveElement();
    const hadFocus = !!active && this.containsDeep(active);
    this.remove();
    if (this.restoreFocusOnClose && hadFocus) {
      this.restoreFocus?.();
    }
  }

  private containsDeep(node: Node) {
    let current: Node | null = node;
    while (current) {
      if (current === this) {
        return true;
      }
      current = current.parentNode ?? (current as ShadowRoot).host ?? null;
    }
    return false;
  }

  render() {
    return html`<slot></slot>`;
  }
}

/**
 * Renders the drawer stack: the top drawer is shown, lower ones stay mounted but hidden so they keep
 * their state. Place it in the layout's drawer column. Without one, drawers open in a floating
 * outlet at the inline end of the viewport.
 */
@customElement("bit-drawer-outlet")
export class BitDrawerOutlet extends BitElement {
  static styles = [
    BitElement.styles,
    css`
      :host {
        display: block;
        height: 100%;
      }
      :host([floating]) {
        ${unsafeCSS(popoverResetCss)}
        inset-block: 0;
        inset-inline-start: auto;
        inset-inline-end: 0;
        height: 100%;
        max-height: none;
        width: min(100vw, var(--bit-drawer-width, 32rem));
        box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1);
      }
      :host([floating]:not(:popover-open)) {
        display: none;
      }
    `,
  ];

  /** @internal Created automatically when no outlet is connected. */
  @property({ type: Boolean, reflect: true }) floating = false;

  private unsubscribe?: () => void;

  connectedCallback() {
    super.connectedCallback();
    if (!this.floating) {
      outlets.add(this);
    }
    this.unsubscribe = drawerStack.subscribe(() => this.sync());
    this.sync();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    outlets.delete(this);
    this.unsubscribe?.();
  }

  private sync() {
    if (this.floating && outlets.size > 0) {
      // A layout outlet appeared; hand the drawers over.
      this.hidePopoverIfOpen();
      return;
    }
    if (!this.floating && [...outlets].at(-1) !== this) {
      return;
    }
    const hosts = drawerStack.hosts;
    hosts.forEach((host, index) => {
      if (host.parentNode !== this) {
        this.append(host);
      }
      host.hidden = index !== hosts.length - 1;
    });
    if (this.floating) {
      this.style.setProperty("--bit-drawer-width", `${drawerStack.pushWidthPx || 512}px`);
      if (hosts.length && !this.matches(":popover-open")) {
        this.showPopover();
      } else if (!hosts.length) {
        this.hidePopoverIfOpen();
      }
    }
  }

  private hidePopoverIfOpen() {
    if (this.matches(":popover-open")) {
      this.hidePopover();
    }
  }

  render() {
    return html`<slot></slot>`;
  }
}

const outlets = new Set<BitDrawerOutlet>();
let floatingOutlet: BitDrawerOutlet | undefined;

function ensureOutlet() {
  if (outlets.size > 0) {
    return;
  }
  if (!floatingOutlet) {
    floatingOutlet = document.createElement("bit-drawer-outlet");
    floatingOutlet.floating = true;
    floatingOutlet.setAttribute("popover", "manual");
  }
  if (!floatingOutlet.isConnected) {
    document.body.append(floatingOutlet);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bit-drawer-host": BitDrawerHost;
    "bit-drawer-outlet": BitDrawerOutlet;
  }
}
