import { ContextConsumer, ContextProvider } from "@lit/context";
import { css, html, nothing, PropertyValues } from "lit";
import { customElement, property, query, state } from "lit/decorators.js";
import { styleMap } from "lit/directives/style-map.js";

import { resolveAriaTarget, setAriaAttributes } from "../core/aria";
import { BitElement } from "../core/bit-element";
import { getDeepActiveElement, getFocusableElements } from "../core/focus";
import { t } from "../core/i18n";

import { SlotAssignController } from "./nav-context";
import { resizeHandlePercent } from "./side-nav-resize";
import { defaultSideNavState, SideNavState, sideNavContext } from "./side-nav-state";
import { SIDERAIL_WIDTH_REM } from "./side-nav-width";
import "../icon-button/icon-button";
import "./nav-divider";

export type SideNavVariant = "primary" | "secondary";
export type SideNavHeaderBorder = "always" | "scrolled";

/** CDK drag's default start threshold, so a click on the handle doesn't count as a drag. */
const DRAG_START_THRESHOLD_PX = 5;

const media = (query: string) => window.matchMedia(query);

const HANDLE_CLASS =
  "tw-absolute tw-top-0 -tw-right-0.5 tw-z-30 tw-h-full tw-w-1 tw-cursor-col-resize tw-transition-colors tw-duration-[250ms] hover:tw-ease-in-out hover:tw-delay-[250ms] hover:tw-bg-border-accent-primary focus:tw-outline-none focus-visible:tw-bg-border-accent-primary before:tw-content-[''] before:tw-absolute before:tw-block before:tw-inset-y-0 before:-tw-left-0.5 before:-tw-right-1";

/**
 * Side navigation with a collapsible icon rail, a resizable (and persisted) width, and an overlay
 * mode on small screens. Place it in a `bit-layout`, which decides push vs. overlay.
 *
 * @slot - Nav items, groups, sections and dividers.
 * @slot logo - A `bit-nav-logo` (assigned automatically by tag).
 * @slot product-switcher - Product switcher, pinned under the logo (VFO1) or at the bottom (legacy).
 * @slot header - Additional pinned header content, after the product switcher.
 * @slot footer - Footer content shown while open. Legacy design only.
 * @slot callout - Footer callout shown while open. VFO1 design only.
 * @slot account - Account controls pinned at the bottom. VFO1 design only.
 */
@customElement("bit-side-nav")
export class BitSideNav extends BitElement {
  static shadowRootOptions: ShadowRootInit = {
    ...BitElement.shadowRootOptions,
    slotAssignment: "manual",
  };

  static styles = [
    BitElement.styles,
    css`
      :host {
        display: block;
        height: 100%;
        grid-column-start: 1;
        grid-row-start: 1;
      }
      /* Overlay mode: fixed so it escapes the layout grid and renders above the scrim. The 90% cap
         is a percentage, not 90vw, so it measures the fixed element's containing block. */
      :host([overlay]) {
        position: fixed;
        top: 0;
        bottom: 0;
        left: 0;
        z-index: 50;
        max-width: 90%;
      }
      :host([variant="secondary"][data-nav-version="vfo1"]) {
        --color-nav-bg-brand: var(--color-nav-bg-admin);
        --color-nav-bg-brand-soft: var(--color-nav-bg-admin-soft);
        --color-nav-bg-brand-hover: var(--color-nav-bg-admin-hover);
      }
      :host([variant="secondary"][data-nav-version="default"]) {
        --color-nav-fg-primary: var(--color-nav-fg-secondary);
        --color-nav-bg-primary: var(--color-nav-bg-secondary);
        --color-nav-bg-primary-strong: var(--color-nav-bg-secondary-strong);
        --color-nav-bg-primary-hover: var(--color-nav-bg-secondary-hover);
        --color-nav-bg-primary-hover-strong: var(--color-nav-bg-secondary-hover-strong);
        --color-nav-border-primary-focus: var(--color-nav-border-secondary-focus);
        --color-nav-border-primary: var(--color-nav-border-secondary);
      }
      [data-nav-column],
      #bit-side-nav--scroll {
        scrollbar-color: var(--color-nav-fg-body) transparent;
      }
      :host([data-nav-version="default"]) #bit-side-nav--scroll {
        scrollbar-color: unset;
      }
    `,
  ];

  /** Visual variant of the side navigation. */
  @property({ reflect: true }) variant: SideNavVariant = "primary";

  /** When to show the line under the VFO1 header's switchers: always, or once rows scroll beneath it. */
  @property({ attribute: "header-border" }) headerBorder: SideNavHeaderBorder = "scrolled";

  /**
   * Renders the pre-VFO1 design (the `VFO1Foundation` feature flag off).
   *
   * @deprecated Remove when the VFO1 flag is removed.
   */
  @property({ type: Boolean, reflect: true }) legacy = false;

  /**
   * The state to use when not inside a `bit-layout` (which provides its own). Defaults to the
   * shared `defaultSideNavState`.
   */
  @property({ attribute: false }) sideNavState?: SideNavState;

  @state() private scrolled = false;
  @state() private hasHeaderContent = false;
  @state() private hasFooterContent = false;
  @state() private hasTopLevelSection = false;

  @query("#bit-side-nav") private navEl?: HTMLElement;
  @query("[data-toggle]") private toggleButton?: HTMLElement;

  private readonly ancestor = new ContextConsumer(
    this,
    sideNavContext,
    () => this.syncState(),
    true,
  );
  private readonly provider = new ContextProvider(this, sideNavContext, defaultSideNavState);
  private subscribed?: SideNavState;
  private unsubscribe?: () => void;

  private readonly coarsePointer = media("(pointer: coarse)");
  private readonly reducedMotion = media("(prefers-reduced-motion: reduce)");

  private dragStartX?: number;
  private dragging = false;

  private readonly slots = new SlotAssignController(this, { logo: "bit-nav-logo" }, () => {
    const has = (...names: string[]) => names.some((n) => this.slots.nodesFor(n).length > 0);
    const header = has("product-switcher", "header");
    const footer = has("callout", "account");
    const section = this.slots
      .nodesFor("")
      .some((node) => node instanceof Element && node.localName === "bit-nav-section");
    if (header !== this.hasHeaderContent) {
      this.hasHeaderContent = header;
    }
    if (footer !== this.hasFooterContent) {
      this.hasFooterContent = footer;
    }
    if (section !== this.hasTopLevelSection) {
      this.hasTopLevelSection = section;
    }
  });

  /** The state this nav renders: the enclosing layout's, else `sideNavState`, else the default. */
  get state(): SideNavState {
    return this.ancestor.value ?? this.sideNavState ?? defaultSideNavState;
  }

  connectedCallback() {
    super.connectedCallback();
    this.syncState();
    window.addEventListener("keydown", this.onWindowKeydown);
    this.coarsePointer.addEventListener("change", this.rerender);
    this.reducedMotion.addEventListener("change", this.rerender);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.state.setLegacy(this, false);
    this.unsubscribe?.();
    this.unsubscribe = undefined;
    this.subscribed = undefined;
    window.removeEventListener("keydown", this.onWindowKeydown);
    this.coarsePointer.removeEventListener("change", this.rerender);
    this.reducedMotion.removeEventListener("change", this.rerender);
  }

  private readonly rerender = () => this.requestUpdate();

  private syncState() {
    const state = this.state;
    if (state === this.subscribed) {
      return;
    }
    this.subscribed?.setLegacy(this, false);
    this.unsubscribe?.();
    this.subscribed = state;
    this.unsubscribe = state.subscribe(this.rerender);
    state.connect();
    state.setLegacy(this, this.legacy);
    this.provider.setValue(state, true);
    this.requestUpdate();
  }

  protected willUpdate(changed: PropertyValues<this>) {
    if (changed.has("sideNavState")) {
      this.syncState();
    }
    if (changed.has("legacy")) {
      this.state.setLegacy(this, this.legacy);
    }
    const state = this.state;
    this.toggleAttribute("overlay", state.isOverlay);
    this.setAttribute("data-nav-version", state.version);
  }

  protected updated(changed: PropertyValues<this>) {
    super.updated(changed);
    const toggle = this.toggleButton;
    const nav = this.navEl;
    if (toggle) {
      void setAriaAttributes(toggle, { "aria-expanded": String(this.state.open) });
      void resolveAriaTarget(toggle).then((target) => {
        target.ariaControlsElements = nav ? [nav] : null;
      });
    }
  }

  // Overlay focus can sit outside the nav (e.g. on <main> after a drag), so Escape is handled at
  // the window, after document-level overlays (menus, popovers) had the chance to consume it.
  private readonly onWindowKeydown = (event: KeyboardEvent) => {
    if (event.key !== "Escape") {
      return;
    }
    const focusInNav = event.composedPath().includes(this);
    if (event.defaultPrevented || !(this.state.isOverlay || focusInNav)) {
      return;
    }
    event.preventDefault();
    this.state.open = false;
    void this.updateComplete.then(() => this.toggleButton?.focus());
  };

  /** Traps Tab within the nav while it overlays the content. */
  private onKeydown(event: KeyboardEvent) {
    if (event.key !== "Tab" || !this.state.isOverlay) {
      return;
    }
    const focusable = getFocusableElements(this);
    if (focusable.length === 0) {
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = getDeepActiveElement();
    if (event.shiftKey && active === first) {
      event.preventDefault();
      event.stopPropagation();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      event.stopPropagation();
      first.focus();
    }
  }

  private onScroll(event: Event) {
    this.scrolled = (event.target as HTMLElement).scrollTop > 0;
  }

  private onHandlePointerDown(event: PointerEvent) {
    if (this.coarsePointer.matches || event.button !== 0) {
      return;
    }
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    this.dragStartX = event.clientX;
    this.dragging = false;
  }

  private onHandlePointerMove(event: PointerEvent) {
    if (this.dragStartX === undefined) {
      return;
    }
    if (!this.dragging && Math.abs(event.clientX - this.dragStartX) < DRAG_START_THRESHOLD_PX) {
      return;
    }
    this.dragging = true;
    this.state.setWidthFromDrag(event.clientX, this.getBoundingClientRect().x);
  }

  private onHandlePointerUp() {
    if (this.dragStartX === undefined) {
      return;
    }
    this.dragStartX = undefined;
    if (this.dragging) {
      this.dragging = false;
      this.state.onDragEnd();
    }
  }

  private onHandleKeydown(event: KeyboardEvent) {
    if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      event.preventDefault();
      this.state.setWidthFromKeys(event.key);
    }
  }

  private get animateWidth() {
    return this.state.transitionsEnabled && !this.state.isDragging && !this.reducedMotion.matches;
  }

  private renderHandle() {
    const state = this.state;
    const percent = resizeHandlePercent(state.open ? state.widthRem : SIDERAIL_WIDTH_REM);
    return html`<div
      class=${HANDLE_CLASS}
      tabindex="0"
      role="separator"
      aria-valuenow=${percent}
      aria-valuemax="100"
      aria-valuemin="0"
      aria-orientation="vertical"
      aria-label=${t("resizeSideNavigation")}
      style=${styleMap({ touchAction: "none" })}
      @pointerdown=${this.onHandlePointerDown}
      @pointermove=${this.onHandlePointerMove}
      @pointerup=${this.onHandlePointerUp}
      @pointercancel=${this.onHandlePointerUp}
      @keydown=${this.onHandleKeydown}
    ></div>`;
  }

  private renderToggle(open: boolean, legacy: boolean) {
    return html`<bit-icon-button
      data-toggle
      class=${legacy ? "tw-mx-auto tw-block" : ""}
      icon=${
        legacy
          ? open
            ? "bwi-angle-left"
            : "bwi-angle-right"
          : open
            ? "bwi-collapse-nav"
            : "bwi-expand-nav"
      }
      button-type="side-nav"
      size="small"
      label=${t("toggleSideNavigation")}
      @click=${() => this.state.toggle()}
    ></bit-icon-button>`;
  }

  private renderVfo1() {
    const state = this.state;
    const { open, isOverlay } = state;
    // Collapsed: center a 40px column in whatever width the scrollbar gutters leave.
    const railPadding = "tw-px-[calc((100%_-_2.5rem)/2)]";
    // Header and footer stay pinned unless open and under 600px, where the whole column scrolls.
    const shrinkToFit = open ? "[@container_(min-height:600px)]:tw-min-h-0" : "tw-min-h-0";
    const headerBorder = this.headerBorder === "always" || this.scrolled;

    return html`<div
        id="bit-side-nav"
        data-nav-version="vfo1"
        class="tw-sticky tw-inset-y-0 tw-left-0 tw-z-30 tw-flex tw-h-full tw-flex-col tw-overflow-hidden tw-bg-bg-nav tw-text-fg-nav tw-outline-none tw-@container-[size] ${
          isOverlay ? "tw-max-w-full" : ""
        }"
        style=${styleMap({
          width: `${state.dragDisplayWidth ?? (open ? state.widthRem : SIDERAIL_WIDTH_REM)}rem`,
          transition: this.animateWidth ? "width 150ms ease-out" : "none",
        })}
      >
        <div
          data-nav-column
          class="tw-flex tw-h-full tw-flex-col tw-overflow-y-auto tw-overscroll-none"
        >
          <nav
            class="tw-flex tw-flex-1 tw-flex-col ${shrinkToFit}"
            aria-label=${t("sideNavigation")}
          >
            <!-- Outside the scroller so the divider spans its gutters. -->
            <div
              data-testid="side-nav-header"
              class="tw-flex tw-shrink-0 tw-pb-3 tw-justify-between tw-items-center tw-border-0 tw-border-solid tw-border-b tw-border-border-nav-divider ${
                open ? "tw-px-3 tw-gap-2" : `${railPadding} tw-flex-col tw-gap-1`
              } ${isOverlay ? "" : "tw-pt-3"}"
              style=${styleMap({
                paddingTop: isOverlay
                  ? "calc(0.75rem + var(--bit-sidenav-extra-top-padding, 0px))"
                  : undefined,
              })}
            >
              <slot name="logo"></slot>
              ${this.renderToggle(open, false)}
            </div>
            <!-- Pinned so rows scroll beneath it; keeps its wider 48px collapsed column. The border
                 overlays so toggling never shifts rows; hidden when empty to avoid doubling the
                 header's. The inner div caps tall content so body rows stay reachable; its padding
                 keeps focus rings unclipped. -->
            <div
              class="tw-relative tw-w-full tw-shrink-0 tw-bg-bg-nav after:tw-absolute after:tw-inset-x-0 after:tw-bottom-0 after:tw-h-px after:tw-bg-border-nav-divider after:tw-content-[''] motion-safe:after:tw-transition-opacity ${
                headerBorder ? "after:tw-opacity-100" : "after:tw-opacity-0"
              } ${this.hasHeaderContent ? "" : "after:tw-hidden"}"
            >
              <div
                class="${this.hasHeaderContent ? "tw-py-2" : "tw-pt-2"} ${
                  open
                    ? "tw-px-2 [@container_(min-height:600px)]:tw-max-h-[40cqh] [@container_(min-height:600px)]:tw-overflow-y-auto"
                    : "tw-px-[calc((100%_-_3rem)/2)]"
                }"
              >
                <slot name="product-switcher"></slot><slot name="header"></slot>
              </div>
            </div>
            <!-- No overscroll-none: it would trap wheel scroll that must chain to the column.
                 Collapsed only: reserve gutters so classic scrollbars never squish the rail icons. -->
            <div
              class="tw-flex-1 tw-overflow-auto ${
                open ? shrinkToFit : "tw-min-h-0 [scrollbar-gutter:stable_both-edges]"
              }"
              id="bit-side-nav--scroll"
              @scroll=${this.onScroll}
            >
              <!-- Rows sit tight; top-level sections widen the gap to space themselves apart. -->
              <div
                data-testid="side-nav-body"
                class="tw-flex tw-flex-col tw-pt-2 ${
                  this.hasTopLevelSection ? "tw-gap-2" : "tw-gap-0.5"
                } ${this.hasFooterContent ? "tw-pb-2" : "tw-pb-3"} ${
                  open ? "tw-px-3" : railPadding
                }"
              >
                <slot></slot>
              </div>
            </div>
          </nav>
          <div
            data-footer
            class="tw-shrink-0 tw-py-3 tw-flex tw-flex-col tw-gap-2 tw-border-solid tw-border-0 tw-border-t tw-border-border-nav-divider ${
              open ? "tw-px-3" : railPadding
            }"
            ?hidden=${!this.hasFooterContent}
          >
            ${open ? html`<slot name="callout"></slot>` : nothing}
            <slot name="account"></slot>
          </div>
        </div>
      </div>
      ${this.renderHandle()}`;
  }

  private renderLegacy() {
    const state = this.state;
    const { open, isOverlay } = state;
    const width = state.dragDisplayWidth ?? (open ? state.widthRem : undefined);
    return html`<nav
        id="bit-side-nav"
        data-nav-version="default"
        class="tw-sticky tw-inset-y-0 tw-left-0 tw-z-30 tw-flex tw-h-full tw-flex-col tw-overflow-hidden tw-bg-bg-nav tw-text-fg-nav tw-outline-none ${
          isOverlay ? "tw-max-w-full" : ""
        }"
        style=${styleMap({
          width: width === undefined ? undefined : `${width}rem`,
          transition: this.animateWidth ? "width 150ms ease-out" : "none",
        })}
        aria-label=${t("sideNavigation")}
      >
        <div
          class="tw-flex-1 tw-min-h-0 tw-overflow-auto tw-overscroll-none tw-@container-[size]"
          id="bit-side-nav--scroll"
        >
          <div class="tw-flex tw-flex-col tw-min-h-full">
            <div class="tw-flex-1">
              <slot name="logo"></slot>
              <slot></slot>
            </div>
            ${
              open
                ? html`<div
                    class="tw-w-full tw-bg-bg-nav [@container_(min-height:600px)]:tw-sticky [@container_(min-height:600px)]:tw-bottom-0"
                  >
                    <slot name="product-switcher"></slot><slot name="header"></slot>
                  </div>`
                : nothing
            }
          </div>
        </div>
        <div class="tw-w-full tw-bg-bg-nav">
          <bit-nav-divider></bit-nav-divider>
          ${open ? html`<slot name="footer"></slot>` : nothing}
          <div class="tw-m-4">${this.renderToggle(open, true)}</div>
        </div>
      </nav>
      ${this.renderHandle()}`;
  }

  render() {
    const isOverlay = this.state.isOverlay;
    return html`<div
      class="tw-relative tw-h-full"
      role=${isOverlay ? "dialog" : nothing}
      aria-modal=${isOverlay ? "true" : nothing}
      aria-label=${isOverlay ? t("sideNavigation") : nothing}
      @keydown=${this.onKeydown}
    >
      ${this.state.version === "vfo1" ? this.renderVfo1() : this.renderLegacy()}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bit-side-nav": BitSideNav;
  }
}
