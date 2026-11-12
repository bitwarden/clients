import { ContextConsumer, createContext } from "@lit/context";
import { ReactiveController, ReactiveControllerHost } from "lit";

import { resolveArrowStep, resolveDragFromClosed, resolveDragFromOpen } from "./side-nav-resize";
import {
  getRootFontSizePx,
  localStorageSideNavWidth,
  pxToRem,
  SIDE_NAV_WIDTH_BOUNDS,
  SideNavWidthStorage,
  SideNavWidthStore,
} from "./side-nav-width";

export type SideNavVersion = "default" | "vfo1";

export type SideNavCollapsePreference = "open" | "closed" | null;

type Fields = {
  open: boolean;
  isPushMode: boolean;
  userCollapsePreference: SideNavCollapsePreference;
  isDragging: boolean;
  layoutReady: boolean;
  dragDisplayWidth: number | null;
  widthResizedByUser: boolean;
};

/**
 * The side nav state machine: open/closed, push/overlay, transition gating, and what a resize
 * gesture means. Replaces Angular's `SideNavService` + `SideNavWidthService`.
 *
 * `bit-layout` provides one to its side nav and nav items through `sideNavContext`. By default
 * every layout shares `defaultSideNavState` (like Angular's root service), so a collapse
 * preference survives switching between layouts; pass a separate instance for isolation.
 */
export class SideNavState {
  private readonly listeners = new Set<() => void>();
  private readonly legacySources = new Set<object>();
  private readonly widthStore: SideNavWidthStore;
  private stopNavigationWatch?: () => void;

  private readonly s: Fields = {
    open: false,
    isPushMode: false,
    userCollapsePreference: null,
    isDragging: false,
    layoutReady: false,
    dragDisplayWidth: null,
    widthResizedByUser: false,
  };

  /** @param widthStorage Where to persist the width. `undefined` uses `localStorage`; `null` disables persistence. */
  constructor(widthStorage?: SideNavWidthStorage | null) {
    this.widthStore = new SideNavWidthStore(
      widthStorage === undefined ? localStorageSideNavWidth() : widthStorage,
      () => this.notify(),
    );
  }

  /** Runs `listener` on any change. Returns an unsubscribe function. */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Replace the width persistence. Call before the first layout renders. */
  setWidthStorage(storage: SideNavWidthStorage | null) {
    this.widthStore.setStorage(storage);
  }

  /** @internal Called by `bit-layout` / `bit-side-nav` on connect. Reads the persisted width once. */
  connect() {
    this.widthStore.hydrate();
    // vfo1 top-level groups have no href, so a navigation means the user picked a page.
    this.stopNavigationWatch ??= watchNavigation(() => {
      if (this.version === "vfo1" && this.isOverlay) {
        this.open = false;
      }
    });
  }

  /**
   * `"default"` while any registered source (a `legacy` layout, side nav or page) asks for the
   * pre-VFO1 design.
   */
  get version(): SideNavVersion {
    return this.legacySources.size > 0 ? "default" : "vfo1";
  }

  /** @internal */
  setLegacy(source: object, legacy: boolean) {
    const had = this.legacySources.has(source);
    if (legacy && !had) {
      this.legacySources.add(source);
      this.notify();
    } else if (!legacy && had) {
      this.legacySources.delete(source);
      this.notify();
    }
  }

  /** Whether the side navigation is open or closed. */
  get open() {
    return this.s.open;
  }
  set open(value: boolean) {
    this.set("open", value);
  }

  /** Whether the nav occupies its own grid column. Set by `bit-layout`. */
  get isPushMode() {
    return this.s.isPushMode;
  }
  set isPushMode(value: boolean) {
    this.set("isPushMode", value);
  }

  /** True when the nav is open but not in push mode — it overlays the content. */
  get isOverlay() {
    return this.s.open && !this.s.isPushMode;
  }

  /**
   * Explicit user preference for open/closed state, set when the user manually toggles the nav.
   * `null` means no preference (auto-open when push mode allows).
   */
  get userCollapsePreference() {
    return this.s.userCollapsePreference;
  }
  set userCollapsePreference(value: SideNavCollapsePreference) {
    this.set("userCollapsePreference", value);
  }

  /** True while the user is dragging the resize handle. Disables width transitions. */
  get isDragging() {
    return this.s.isDragging;
  }

  /** True once the initial width and layout have settled, so width changes may animate. */
  get transitionsEnabled() {
    return this.widthStore.hydrated && this.s.layoutReady;
  }

  /**
   * Visual width override (in rem) during a drag: the preview below the minimum when dragging out
   * from collapsed, and the tension shrink when an open nav is dragged toward the snap threshold.
   * Never persisted. `null` when no drag is in progress.
   */
  get dragDisplayWidth() {
    return this.s.dragDisplayWidth;
  }

  /** True once the saved width has been read, so callers can tell startup from a resize. */
  get widthHydrated() {
    return this.widthStore.hydrated;
  }

  /** True once the user has resized the nav themselves, which ends startup on its own. */
  get widthResizedByUser() {
    return this.s.widthResizedByUser;
  }

  /** Current nav width, in rem. */
  get widthRem() {
    return this.widthStore.width;
  }

  /**
   * Called by `bit-layout` from its first ResizeObserver callback. That callback runs before the
   * browser paints the frame, and so does `requestAnimationFrame` — arming the width transition in
   * either means arming it in the same frame that first paints the width, and the nav animates in
   * on page load. `setTimeout` is the next macrotask, i.e. after the paint.
   */
  armTransitionsAfterFirstPaint() {
    if (!this.s.layoutReady) {
      setTimeout(() => this.set("layoutReady", true));
    }
  }

  /** Toggle the open/close state of the side nav. */
  toggle() {
    if (this.s.open) {
      this.userCollapsePreference = "closed";
      this.open = false;
      return;
    }
    this.expand();
  }

  /**
   * Set new side nav width from drag event coordinates.
   *
   * @param eventXPointer x coordinate of the pointer
   * @param dragElementXCoordinate x coordinate of the nav's bounding client rect
   */
  setWidthFromDrag(eventXPointer: number, dragElementXCoordinate: number) {
    this.set("isDragging", true);
    this.set("widthResizedByUser", true);

    const newWidthInRem = pxToRem(eventXPointer - dragElementXCoordinate, getRootFontSizePx());

    if (!this.s.open) {
      // Dragging out from collapsed — a preview drives the visual width without changing `open`,
      // so push/overlay mode and open-state styling stay put until the nav actually opens.
      const step = resolveDragFromClosed(newWidthInRem);
      if (step.action === "preview") {
        this.set("dragDisplayWidth", step.width);
        return;
      }
      this.set("dragDisplayWidth", null);
      if (step.action === "open") {
        this.userCollapsePreference = "open";
        this.open = true;
        this.widthStore.display(this.widthStore.clamp(step.width));
      }
      return;
    }

    const step = resolveDragFromOpen(newWidthInRem);
    if (step.action === "tension") {
      this.set("dragDisplayWidth", step.width);
      return;
    }
    this.set("dragDisplayWidth", null);
    if (step.action === "collapse") {
      this.userCollapsePreference = "closed";
      this.open = false;
      // Discard the widths this drag painted on the way down and go back to the user's.
      this.widthStore.display(this.widthStore.saved());
      return;
    }
    this.widthStore.display(this.widthStore.clamp(step.width));
  }

  /** Set new side nav width from an arrow key. */
  setWidthFromKeys(key: "ArrowRight" | "ArrowLeft") {
    this.set("widthResizedByUser", true);

    const step = resolveArrowStep(key, this.widthRem, this.s.open);
    switch (step.action) {
      case "expand":
        this.expand();
        return;
      case "collapse":
        this.userCollapsePreference = "closed";
        this.open = false;
        return;
      case "commit":
        this.widthStore.commit(step.width);
        return;
      case "noop":
        return;
    }
  }

  /** A drag only ever paints. Release is the single place it becomes a preference, so a gesture
   *  that ends collapsed cannot overwrite the width the user had. */
  onDragEnd() {
    this.set("isDragging", false);

    const preview = this.s.dragDisplayWidth;
    this.set("dragDisplayWidth", null);

    if (!this.s.open) {
      // Released in the collapsed preview zone — open at the width the user already had.
      // Otherwise the drag snapped closed, which says nothing about the width.
      if (preview !== null) {
        this.expand();
      }
      return;
    }

    if (preview !== null) {
      // Released in the tension zone — spring back to the minimum.
      this.widthStore.commit(SIDE_NAV_WIDTH_BOUNDS.min);
      return;
    }

    this.widthStore.commit(this.widthRem);
  }

  /** Open at the width the user last chose. Display-only, so restoring it is not a new
   *  preference and a later collapse still returns to the same width. */
  private expand() {
    this.userCollapsePreference = "open";
    this.open = true;
    this.widthStore.display(this.widthStore.saved());
  }

  private set<K extends keyof Fields>(key: K, value: Fields[K]) {
    if (this.s[key] !== value) {
      this.s[key] = value;
      this.notify();
    }
  }

  private notify() {
    this.listeners.forEach((listener) => listener());
  }
}

/** Calls `onNavigate` after history traversal, hash changes, or Navigation API navigations. */
function watchNavigation(onNavigate: () => void): () => void {
  const navigation = (window as Window & { navigation?: EventTarget }).navigation;
  window.addEventListener("popstate", onNavigate);
  window.addEventListener("hashchange", onNavigate);
  navigation?.addEventListener("navigatesuccess", onNavigate);
  return () => {
    window.removeEventListener("popstate", onNavigate);
    window.removeEventListener("hashchange", onNavigate);
    navigation?.removeEventListener("navigatesuccess", onNavigate);
  };
}

/** Shared by layouts and side navs that aren't given their own `SideNavState`. */
export const defaultSideNavState = new SideNavState();

export const sideNavContext = createContext<SideNavState>(Symbol("bit-side-nav-state"));

/**
 * Resolves the nearest `SideNavState` (falling back to `defaultSideNavState`) and re-renders the
 * host whenever it changes.
 *
 * @internal
 */
export class SideNavStateController implements ReactiveController {
  private unsubscribe?: () => void;
  private subscribed?: SideNavState;
  private readonly consumer: ContextConsumer<
    typeof sideNavContext,
    ReactiveControllerHost & HTMLElement
  >;

  constructor(private readonly host: ReactiveControllerHost & HTMLElement) {
    host.addController(this);
    this.consumer = new ContextConsumer(host, sideNavContext, () => this.sync(), true);
  }

  get state(): SideNavState {
    return this.consumer.value ?? defaultSideNavState;
  }

  hostConnected() {
    this.sync();
  }

  hostDisconnected() {
    this.unsubscribe?.();
    this.unsubscribe = undefined;
    this.subscribed = undefined;
  }

  private sync() {
    const state = this.state;
    if (state === this.subscribed) {
      return;
    }
    this.unsubscribe?.();
    this.subscribed = state;
    this.unsubscribe = state.subscribe(() => this.host.requestUpdate());
    this.host.requestUpdate();
  }
}
