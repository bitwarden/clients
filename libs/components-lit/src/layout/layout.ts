import { ContextProvider } from "@lit/context";
import { css, html, nothing, PropertyValues } from "lit";
import { customElement, property, query, state } from "lit/decorators.js";
import { styleMap } from "lit/directives/style-map.js";

import { BitElement } from "../core/bit-element";
import { trapFocus } from "../core/focus";
import { t } from "../core/i18n";
import { drawerSizeToWidthRem, drawerStack } from "../dialog/drawer";
import { SlotAssignController } from "../navigation/nav-context";
import { defaultSideNavState, SideNavState, sideNavContext } from "../navigation/side-nav-state";
import {
  getRootFontSizePx,
  remToPx,
  SIDE_NAV_WIDTH_BOUNDS,
  SIDERAIL_WIDTH_REM,
} from "../navigation/side-nav-width";

import { layoutFooter } from "./layout-footer";
import { MAIN_CONTENT_MIN_WIDTH_REM } from "./layout-metrics";
import { attachScrollLayoutHost } from "./scroll-layout";
import "../link/link";

const MAIN_CONTENT_ID = "main-content";

const isNothingFocused = (): boolean =>
  [document.documentElement, document.body, null].includes(document.activeElement as HTMLElement);

/**
 * The application shell: a side nav column, the main content area, and a drawer column for
 * push-mode drawers (`openDrawer`). Decides whether the side nav and drawer push the content or
 * overlay it, based on the available width.
 *
 * @slot - Main content. Use `bit-page` for full-height pages that own their scrolling.
 * @slot side-nav - A `bit-side-nav` (assigned automatically by tag).
 * @slot footer - Content pinned to the bottom of the main column (see also `layoutFooter`).
 */
@customElement("bit-layout")
export class BitLayout extends BitElement {
  static shadowRootOptions: ShadowRootInit = {
    ...BitElement.shadowRootOptions,
    slotAssignment: "manual",
  };

  static styles = [
    BitElement.styles,
    css`
      :host {
        display: block;
        height: 100vh;
      }
    `,
  ];

  /** Rounded top start corner for the main content area. */
  @property({ type: Boolean, reflect: true }) rounded = false;

  /**
   * Renders the pre-VFO1 design (the `VFO1Foundation` feature flag off). Applies to the slotted
   * side nav, nav items and `bit-page` too.
   *
   * @deprecated Remove when the VFO1 flag is removed.
   */
  @property({ type: Boolean, reflect: true }) legacy = false;

  /** Side nav state shared with the slotted side nav. Defaults to `defaultSideNavState`. */
  @property({ attribute: false }) sideNavState?: SideNavState;

  @state() private hasSideNav = false;
  @state() private hasHeader = false;
  @state() private hasPage = false;
  @state() private containerWidthPx = 0;

  /**
   * Whether the siderail (closed-nav icon strip) fits in its own column. Has a lower threshold than
   * the full nav's push mode because the siderail is much narrower.
   */
  @state() private siderailIsPushMode = false;

  @query("#container") private container?: HTMLElement;
  @query("main") private main?: HTMLElement;
  @query("#drawer-container") private drawerContainer?: HTMLElement;
  @query("bit-link") private skipLink?: HTMLElement;

  private readonly provider = new ContextProvider(this, sideNavContext, defaultSideNavState);
  private subscribed?: SideNavState;
  private cleanups: (() => void)[] = [];
  private resizeObserver?: ResizeObserver;
  private estimated = false;

  private hasReconciled = false;
  private lastDrawerWidthPx = -1;
  private widthHasHydrated = false;
  private lastWidthRem = -1;
  private lastHydrated = false;

  private readonly slots = new SlotAssignController(this, { "side-nav": "bit-side-nav" }, () => {
    const has = this.slots.nodesFor("side-nav").length > 0;
    if (has !== this.hasSideNav) {
      this.hasSideNav = has;
    }
  });

  private readonly contentObserver = new MutationObserver(() => this.detectContent());

  get state(): SideNavState {
    return this.sideNavState ?? defaultSideNavState;
  }

  connectedCallback() {
    super.connectedCallback();
    this.syncState();
    this.estimateOpen();
    this.detectContent();
    this.contentObserver.observe(this, { childList: true, subtree: true });
    document.addEventListener("keydown", this.onDocumentKeydown);
    this.cleanups.push(
      trapFocus(this),
      drawerStack.subscribe(() => {
        this.requestUpdate();
        this.reconcile();
      }),
      layoutFooter.subscribe(() => this.syncFooter()),
    );
    this.syncFooter();
    if (this.hasUpdated) {
      this.startObserving();
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.subscribed?.setLegacy(this, false);
    this.subscribed = undefined;
    this.contentObserver.disconnect();
    document.removeEventListener("keydown", this.onDocumentKeydown);
    this.cleanups.forEach((cleanup) => cleanup());
    this.cleanups = [];
    this.resizeObserver?.disconnect();
    this.resizeObserver = undefined;
  }

  protected willUpdate(changed: PropertyValues<this>) {
    if (changed.has("sideNavState")) {
      this.syncState();
    }
    if (changed.has("legacy")) {
      this.state.setLegacy(this, this.legacy);
    }
    // The theme's `[data-nav-version="default"]` palette remap only matches light-DOM elements, so
    // the nav-colored wedge behind main's rounded corner needs the attribute on the host.
    if (this.rounded) {
      this.setAttribute("data-nav-version", this.state.version);
    } else {
      this.removeAttribute("data-nav-version");
    }
  }

  protected firstUpdated() {
    this.startObserving();
  }

  private startObserving() {
    if (this.resizeObserver || !this.container || !this.drawerContainer || !this.main) {
      return;
    }
    this.resizeObserver = new ResizeObserver(() => this.reconcile());
    this.resizeObserver.observe(this.container);
    this.resizeObserver.observe(this.drawerContainer);
    this.cleanups.push(attachScrollLayoutHost(this.main).destroy);
  }

  private syncState() {
    const state = this.state;
    if (state === this.subscribed) {
      return;
    }
    this.subscribed?.setLegacy(this, false);
    this.cleanups = this.cleanups.filter((cleanup) => cleanup !== this.unsubscribeState);
    this.unsubscribeState?.();
    this.subscribed = state;
    this.unsubscribeState = state.subscribe(() => this.onStateChange());
    this.cleanups.push(this.unsubscribeState);
    state.connect();
    state.setLegacy(this, this.legacy);
    this.provider.setValue(state, true);
  }

  private unsubscribeState?: () => void;

  /**
   * Changing the nav width resizes neither observed element, so push/overlay would otherwise stay
   * stale after a drag or once the persisted width resolves. Hydration counts on its own because
   * the persisted width may equal the default, which leaves the width untouched.
   */
  private onStateChange() {
    this.requestUpdate();
    const { widthRem, widthHydrated } = this.state;
    if (widthRem !== this.lastWidthRem || widthHydrated !== this.lastHydrated) {
      this.lastWidthRem = widthRem;
      this.lastHydrated = widthHydrated;
      this.reconcile();
    }
  }

  /**
   * The first render needs a layout before the ResizeObserver fires, so estimate push mode from the
   * viewport and let `reconcile()` correct it once it can measure. Defers to a user who collapsed
   * the nav, the same rule the reopen branch in `reconcile()` applies.
   */
  private estimateOpen() {
    if (this.estimated) {
      return;
    }
    this.estimated = true;
    const rootFontSizePx = getRootFontSizePx();
    const estimatedPushMode =
      window.innerWidth - remToPx(SIDE_NAV_WIDTH_BOUNDS.default, rootFontSizePx) >=
      remToPx(MAIN_CONTENT_MIN_WIDTH_REM, rootFontSizePx);
    if (estimatedPushMode && this.state.userCollapsePreference !== "closed") {
      this.state.open = true;
    }
  }

  private detectContent() {
    const header = !!this.querySelector("bit-header");
    const page = !!this.querySelector("bit-page");
    if (header !== this.hasHeader) {
      this.hasHeader = header;
    }
    if (page !== this.hasPage) {
      this.hasPage = page;
    }
  }

  private syncFooter() {
    const element = layoutFooter.element;
    if (element && element.parentElement !== this) {
      element.slot = "footer";
      this.append(element);
    }
  }

  /** Decides push vs. overlay for the nav and the drawer from the measured space. */
  private reconcile() {
    const container = this.container;
    if (!container) {
      return;
    }
    const state = this.state;
    const rootFontSizePx = getRootFontSizePx();
    const containerWidth = container.clientWidth;
    const siderailPx = remToPx(SIDERAIL_WIDTH_REM, rootFontSizePx);
    const mainMinPx = remToPx(MAIN_CONTENT_MIN_WIDTH_REM, rootFontSizePx);
    const navWidthPx = remToPx(state.widthRem, rootFontSizePx);
    const drawerMinPx = remToPx(drawerSizeToWidthRem.small, rootFontSizePx);

    // The push width declared by the drawer content (e.g. bit-dialog). More reliable than DOM
    // measurement, since the drawer host fills the whole column in overlay mode.
    const drawerWidthPx = drawerStack.depth > 0 ? drawerStack.pushWidthPx : 0;

    // Did the space around the nav change, or only the nav's own width? Read before the set.
    const constraintsChanged =
      containerWidth !== this.containerWidthPx || drawerWidthPx !== this.lastDrawerWidthPx;

    this.containerWidthPx = containerWidth;

    const navAloneCanPush = containerWidth - navWidthPx >= mainMinPx;
    const drawerFullWidthNavCanPush =
      drawerWidthPx > 0 && containerWidth - navWidthPx - drawerWidthPx >= mainMinPx;
    const drawerFullWidthSiderailCanPush =
      drawerWidthPx > 0 && containerWidth - siderailPx - drawerWidthPx >= mainMinPx;
    const drawerMinWithNavCanPush =
      drawerWidthPx > 0 && containerWidth - navWidthPx - drawerMinPx >= mainMinPx;
    const drawerMinWithSiderailCanPush =
      drawerWidthPx > 0 && containerWidth - siderailPx - drawerMinPx >= mainMinPx;

    // When the drawer is open and space is limited, the full nav yields first — it closes to its
    // siderail so the drawer can remain in push mode. When even the minimum push width doesn't
    // fit, the drawer goes overlay.
    const drawerPush =
      drawerFullWidthNavCanPush ||
      drawerFullWidthSiderailCanPush ||
      drawerMinWithNavCanPush ||
      drawerMinWithSiderailCanPush;
    const navPush = drawerPush
      ? drawerFullWidthNavCanPush || drawerMinWithNavCanPush
      : navAloneCanPush && drawerWidthPx === 0;

    // In shrink-push mode the drawer occupies less than its declared max, so use the actual
    // available space as the effective drawer width for the siderail check.
    const drawerEffectivePx = drawerPush
      ? Math.min(drawerWidthPx, Math.max(0, containerWidth - siderailPx - mainMinPx))
      : 0;
    const siderailCanPush = drawerPush
      ? containerWidth - siderailPx - drawerEffectivePx >= mainMinPx
      : containerWidth - siderailPx >= mainMinPx;

    const wasInPushMode = state.isPushMode;

    // Startup ends when the persisted width lands — or sooner, if the user takes the width over.
    const settled = this.hasReconciled && (this.widthHasHydrated || state.widthResizedByUser);

    // Lost push mode → close, but only because the space around the nav shrank. Widening the
    // nav past what push affords is a request for overlay, not a collapse mid-gesture.
    const lostPushRoom = !navPush && state.open && wasInPushMode;

    // Until then the open estimate may be wrong: it uses the default width, but the persisted
    // width arrives later and may be too wide for push mode at this viewport.
    const estimateWasWrong =
      !settled && !navPush && state.open && state.userCollapsePreference !== "open";

    if ((constraintsChanged && lostPushRoom) || estimateWasWrong) {
      state.open = false;
    }

    // Transitioning into push mode → reopen unless the user explicitly closed it.
    if (navPush && !wasInPushMode && state.userCollapsePreference !== "closed") {
      state.open = true;
    }

    state.isPushMode = navPush;
    this.siderailIsPushMode = siderailCanPush;
    drawerStack.isPushMode = drawerPush;
    state.armTransitionsAfterFirstPaint();
    this.hasReconciled = true;
    this.lastDrawerWidthPx = drawerWidthPx;
    this.widthHasHydrated = state.widthHydrated;
  }

  /**
   * Whether column 1 gets a non-zero track — a side nav is slotted and either the full nav or the
   * siderail fits. Otherwise the nav column collapses to 0px and <main> sits flush.
   */
  private get navOccupiesColumn() {
    return this.hasSideNav && (this.state.isPushMode || this.siderailIsPushMode);
  }

  /**
   * Column 1 (nav):    the nav width when push+open; `auto` when push+closed (icon strip) or when
   *                    only the siderail fits (a placeholder keeps the track stable while the nav
   *                    is fixed/overlay); 0px when even the siderail doesn't fit.
   * Column 2 (main):   minmax(mainMinWidthPx, 1fr) normally, so CSS grid can shrink col 3 without
   *                    JS arithmetic; 0px when the drawer overlays (it takes the full row).
   * Column 3 (drawer): minmax(0, declared width) when pushing; 1fr when overlaying; 0px when closed.
   */
  private get gridTemplateColumns() {
    const state = this.state;
    const drawerActive = drawerStack.depth > 0;
    const declaredDrawerWidth = drawerStack.pushWidthPx;
    const containerWidth = this.containerWidthPx;
    const rootFontSizePx = getRootFontSizePx();
    const siderailWidthPx = remToPx(SIDERAIL_WIDTH_REM, rootFontSizePx);
    const drawerMinWidthPx = remToPx(drawerSizeToWidthRem.small, rootFontSizePx);
    const mainMinWidthPx = remToPx(MAIN_CONTENT_MIN_WIDTH_REM, rootFontSizePx);

    // Push vs overlay: overlay only when the minimum push width won't fit. Falls back to the
    // measured mode before the drawer content declares its width.
    let drawerPush: boolean;
    if (!drawerActive) {
      drawerPush = false;
    } else if (declaredDrawerWidth > 0 && containerWidth > 0) {
      drawerPush = containerWidth - siderailWidthPx - drawerMinWidthPx >= mainMinWidthPx;
    } else {
      drawerPush = drawerStack.isPushMode;
    }

    let col1: string;
    if (!this.navOccupiesColumn) {
      col1 = "0px";
    } else if (state.open && state.isPushMode) {
      col1 = `${state.dragDisplayWidth ?? state.widthRem}rem`;
    } else {
      col1 = "auto";
    }

    let col3: string;
    if (!drawerActive) {
      col3 = "0px";
    } else if (!drawerPush) {
      col3 = "1fr";
    } else if (declaredDrawerWidth > 0) {
      col3 = `minmax(0px, ${declaredDrawerWidth}px)`;
    } else {
      col3 = "auto";
    }
    const col2 = !drawerActive || drawerPush ? `minmax(${mainMinWidthPx}px, 1fr)` : "0px";

    return `${col1} ${col2} ${col3}`;
  }

  private focusMainContent(event: Event) {
    event.preventDefault();
    this.main?.focus();
  }

  /** Focuses the skip link when Tab is first pressed, if nothing else has focus yet. */
  private readonly onDocumentKeydown = (event: KeyboardEvent) => {
    if (event.key === "Tab" && isNothingFocused()) {
      event.preventDefault();
      this.skipLink?.focus();
    }
  };

  private get mainPadding() {
    if (this.hasPage) {
      return "tw-p-0";
    }
    // If updating this padding, also update the padding correction in bit-banner!
    if (this.state.version === "default") {
      return "tw-px-8 tw-pb-8 tw-pt-6";
    }
    return `tw-px-10 tw-pb-10 ${this.hasHeader ? "tw-pt-0" : "tw-pt-6"}`;
  }

  render() {
    const state = this.state;
    const isOverlay = state.isOverlay;
    return html`<div
      id="container"
      class="tw-grid tw-relative tw-size-full tw-overflow-hidden tw-grid-rows-[minmax(0,1fr)] ${
        this.rounded ? "tw-bg-bg-nav" : ""
      }"
      style=${styleMap({ gridTemplateColumns: this.gridTemplateColumns })}
    >
      <!-- Skip-to-content link -->
      <div
        class="tw-fixed tw-z-50 tw-w-full tw-flex tw-justify-center tw-opacity-0 focus-within:tw-opacity-100 tw-pointer-events-none focus-within:tw-pointer-events-auto"
      >
        <nav
          class="tw-bg-background-alt3 tw-rounded-md tw-rounded-t-none tw-py-2 tw-text-alt2"
          aria-label=${t("skipLink")}
        >
          <bit-link
            class="tw-mx-6"
            href="#${MAIN_CONTENT_ID}"
            link-type="light"
            @click=${this.focusMainContent}
            >${t("skipToContent")}</bit-link
          >
        </nav>
      </div>

      <slot name="side-nav"></slot>

      <!-- Siderail width placeholder — keeps the col 1 auto track stable when the nav is
           position:fixed (overlay) and therefore out of the grid's normal flow. -->
      ${
        isOverlay && this.siderailIsPushMode
          ? html`<div
              aria-hidden="true"
              style=${styleMap({ width: `${SIDERAIL_WIDTH_REM}rem` })}
              class="tw-pointer-events-none tw-col-start-1 tw-row-start-1"
            ></div>`
          : nothing
      }

      <main
        id=${MAIN_CONTENT_ID}
        tabindex="-1"
        class="tw-col-start-2 tw-row-start-1 tw-overflow-auto tw-max-h-full tw-bg-background tw-@container ${
          this.mainPadding
        } ${this.rounded && this.navOccupiesColumn ? "tw-rounded-tl-2xl" : ""}"
        style=${styleMap({ minWidth: `${MAIN_CONTENT_MIN_WIDTH_REM}rem` })}
      >
        <slot></slot>
      </main>

      <!-- Footer region: overlaps <main> but is a sibling of it — outside the scroll container — so
           pinned content stays fixed while <main> scrolls. Layout containment makes this the
           containing block for position:fixed content. Clicks pass through to <main>. -->
      <div
        class="tw-col-start-2 tw-row-start-1 tw-z-50 tw-pointer-events-none"
        style="contain: layout"
      >
        <slot name="footer"></slot>
      </div>

      <!-- Overlay backdrop for the side nav (fixed, z-40 — below the nav overlay's z-50) -->
      <div
        class="tw-pointer-events-none tw-fixed tw-inset-0 tw-z-40 tw-bg-black motion-safe:tw-transition-colors ${
          isOverlay ? "tw-bg-opacity-30" : "tw-bg-opacity-0"
        }"
      >
        ${
          isOverlay
            ? html`<div
                class="tw-pointer-events-auto tw-size-full"
                @click=${() => state.toggle()}
              ></div>`
            : nothing
        }
      </div>

      <!-- Drawer (col 3; the track is sized by gridTemplateColumns) -->
      <div
        id="drawer-container"
        class="tw-col-start-3 tw-row-start-1 tw-relative tw-z-30 tw-h-full"
      >
        <bit-drawer-outlet></bit-drawer-outlet>
      </div>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bit-layout": BitLayout;
  }
}
