import { computed, inject, Injectable, signal } from "@angular/core";
import { Observable, fromEvent, map, startWith } from "rxjs";

import {
  getRootFontSizePx,
  LAYOUT_MAIN_CONTENT_MIN_WIDTH_REM,
  SIDERAIL_WIDTH_REM,
} from "../shared";

import { resolveArrowStep, resolveDragFromClosed, resolveDragFromOpen } from "./side-nav-resize";
import { SIDE_NAV_WIDTH_BOUNDS, SideNavWidthService } from "./side-nav-width.service";

export type SideNavVersion = "default" | "vfo1";

@Injectable({
  providedIn: "root",
})
export class SideNavService {
  // Units in rem. Bounds live in side-nav-width.service.ts, which enforces them.
  readonly DEFAULT_OPEN_WIDTH = SIDE_NAV_WIDTH_BOUNDS.default;
  readonly MIN_OPEN_WIDTH = SIDE_NAV_WIDTH_BOUNDS.min;
  readonly MAX_OPEN_WIDTH = SIDE_NAV_WIDTH_BOUNDS.max;

  /** Width of the collapsed nav (icon strip / side rail), in rem. */
  readonly CLOSED_WIDTH = SIDERAIL_WIDTH_REM;

  private rootFontSizePx: number;

  readonly version = signal<SideNavVersion>("default");

  /**
   * Whether the side navigation is open or closed.
   */
  readonly open = signal(false);

  /**
   * Whether the nav is in push mode (occupies its own grid column).
   * Set by LayoutComponent via ResizeObserver.
   */
  readonly isPushMode = signal(false);

  /**
   * True when the nav is open but not in push mode — it overlays the content.
   */
  readonly isOverlay = computed(() => this.open() && !this.isPushMode());

  /**
   * Explicit user preference for open/closed state, set when the user manually
   * toggles the nav. Null means no preference (auto-open when push mode allows).
   */
  readonly userCollapsePreference = signal<"open" | "closed" | null>(null);

  /** True while the user is actively dragging the resize handle. Disables CSS transitions during drag. */
  readonly isDragging = signal(false);

  /**
   * True one tick after the layout's first ResizeObserver callback, so the initial open/width
   * state is painted before transitions turn on and the nav does not animate in on page load.
   */
  private readonly layoutReady = signal(false);

  /** True once the initial width and layout have settled, so width changes may animate. */
  readonly transitionsEnabled = computed(() => this.widthService.hydrated() && this.layoutReady());

  /**
   * Visual width override (in rem) applied during a drag via a direct style binding: the preview
   * below MIN_OPEN_WIDTH when dragging out from collapsed, and the tension shrink when an open nav
   * is dragged toward the snap threshold. Drives width alone — the nav keeps its closed styling
   * until it actually opens. Never persisted. Null when no drag is in progress.
   */
  readonly dragDisplayWidth = signal<number | null>(null);

  /** Owns the width and decides what is persisted. This service never writes to disk itself. */
  private readonly widthService = inject(SideNavWidthService);

  /** True once the saved width has been read from disk, so callers can tell startup from a resize. */
  readonly widthHydrated = this.widthService.hydrated;

  private readonly _widthResizedByUser = signal(false);

  /** True once the user has resized the nav themselves, which ends startup on its own. */
  readonly widthResizedByUser = this._widthResizedByUser.asReadonly();

  /** Current nav width, in rem. */
  readonly widthRem = this.widthService.width;

  constructor() {
    // Get computed root font size to support user-defined a11y font increases
    this.rootFontSizePx = getRootFontSizePx();

    // Estimate the initial open state from window.innerWidth so the first render shows
    // the correct layout before LayoutComponent's ResizeObserver fires.
    const estimatedPushMode =
      window.innerWidth - this.DEFAULT_OPEN_WIDTH * this.rootFontSizePx >=
      LAYOUT_MAIN_CONTENT_MIN_WIDTH_REM * this.rootFontSizePx;
    if (estimatedPushMode) {
      this.open.set(true);
    }
  }

  /** Called by LayoutComponent after its first ResizeObserver callback, to enable transitions once painted. */
  markLayoutReady() {
    if (!this.layoutReady()) {
      setTimeout(() => this.layoutReady.set(true));
    }
  }

  /** Toggle the open/close state of the side nav. */
  toggle() {
    if (this.open()) {
      this.userCollapsePreference.set("closed");
      this.open.set(false);
      return;
    }

    this._expand();
  }

  /**
   * Set new side nav width from drag event coordinates.
   *
   * @param eventXPointer x coordinate of the pointer
   * @param dragElementXCoordinate x coordinate of the drag element's bounding client rect
   */
  setWidthFromDrag(eventXPointer: number, dragElementXCoordinate: number) {
    this.isDragging.set(true);
    this._widthResizedByUser.set(true);

    const newWidthInPixels = eventXPointer - dragElementXCoordinate;
    const newWidthInRem = newWidthInPixels / this.rootFontSizePx;

    if (!this.open()) {
      // Dragging out from collapsed — a preview drives the visual width without changing `open`,
      // so push/overlay mode and open-state styling stay put until the nav actually opens.
      const step = resolveDragFromClosed(newWidthInRem);

      if (step.action === "preview") {
        this.dragDisplayWidth.set(step.width);
        return;
      }

      this.dragDisplayWidth.set(null);

      if (step.action === "open") {
        // The width hands off to the width service now that the nav is genuinely open.
        this.userCollapsePreference.set("open");
        this.open.set(true);
        this.widthService.display(this.widthService.clamp(step.width));
      }
      return;
    }

    const step = resolveDragFromOpen(newWidthInRem);

    if (step.action === "tension") {
      this.dragDisplayWidth.set(step.width);
      return;
    }

    this.dragDisplayWidth.set(null);

    if (step.action === "collapse") {
      this.userCollapsePreference.set("closed");
      this.open.set(false);
      // Discard the widths this drag painted on the way down and go back to the user's.
      this.widthService.display(this.widthService.saved());
      return;
    }

    this.widthService.display(this.widthService.clamp(step.width));
  }

  /**
   * Set new side nav width from arrow key events.
   *
   * @param key event key, must be either ArrowRight or ArrowLeft
   */
  setWidthFromKeys(key: "ArrowRight" | "ArrowLeft") {
    this._widthResizedByUser.set(true);

    const step = resolveArrowStep(key, this.widthRem(), this.open());

    switch (step.action) {
      case "expand":
        this._expand();
        return;
      case "collapse":
        this.userCollapsePreference.set("closed");
        this.open.set(false);
        return;
      case "commit":
        this.widthService.commit(step.width);
        return;
      case "noop":
        return;
    }
  }

  /** A drag only ever paints. Release is the single place it becomes a preference, so a gesture
   *  that ends collapsed cannot overwrite the width the user had. */
  onDragEnd() {
    this.isDragging.set(false);

    const preview = this.dragDisplayWidth();
    this.dragDisplayWidth.set(null);

    if (!this.open()) {
      // Released in the collapsed preview zone — open at the width the user already had.
      // Otherwise the drag snapped closed, which says nothing about the width.
      if (preview !== null) {
        this._expand();
      }
      return;
    }

    if (preview !== null) {
      // Released in the tension zone — spring back to the minimum.
      this.widthService.commit(this.MIN_OPEN_WIDTH);
      return;
    }

    // Released while open — the painted width is the width the user chose.
    this.widthService.commit(this.widthRem());
  }

  /** Open at the width the user last chose. Display-only, so restoring it is not a new
   *  preference and a later collapse still returns to the same width. */
  private _expand() {
    this.userCollapsePreference.set("open");
    this.open.set(true);
    this.widthService.display(this.widthService.saved());
  }
}

/** Emits whether `query` matches, starting with its current value. */
export const media = (query: string): Observable<boolean> => {
  const mediaQuery = window.matchMedia(query);
  return fromEvent<MediaQueryList>(mediaQuery, "change").pipe(
    startWith(mediaQuery),
    map((list: MediaQueryList) => list.matches),
  );
};
