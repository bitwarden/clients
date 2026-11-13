import { ContextConsumer } from "@lit/context";
import { css, html, nothing, PropertyValues } from "lit";
import { customElement, property, query, state } from "lit/decorators.js";

import { BitElement } from "../core/bit-element";
import { t } from "../core/i18n";
import { headerContext } from "../header/header-context";
import type { BitIconTile } from "../icon-tile/icon-tile";
import type { BitMenu } from "../menu/menu";
import { menuTrigger } from "../menu/menu-directive";
import {
  attachOverflowList,
  OverflowListHandle,
  OverflowListState,
} from "../overflow-list/attach-overflow-list";
import { observeWidth } from "../overflow-list/measure";

import {
  BitBreadcrumb,
  BREADCRUMB_CHANGE_EVENT,
  BreadcrumbSize,
  breadcrumbArrow,
} from "./breadcrumb";
import "../icon/icon";
import "../icon-button/icon-button";
import "../menu/menu";
import "../menu/menu-item";

/** Approximate width reserved for the trailing separator arrow (icon + margins), per size, in pixels. */
const TRAILING_ARROW_RESERVE_PX = { base: 48, small: 34 } as const;

/** Space between the promoted heading and the header's title suffix (`tw-ps-1`), in pixels. */
const TITLE_SUFFIX_GAP_PX = 4;

/**
 * Breadcrumbs are used to help users understand where they are in a products navigation. Typically
 * Bitwarden uses this component to indicate the user's current location in a set of data organized in
 * containers (Collections, Folders, or Projects).
 *
 * When the trail doesn't fit, the crumbs between the first and the last collapse into a "More"
 * menu. Slotted into a `bit-header`, the `current` crumb is promoted to the page `<h1>`.
 *
 * @slot - `bit-breadcrumb` elements, root first.
 */
@customElement("bit-breadcrumbs")
export class BitBreadcrumbs extends BitElement {
  // Manual assignment lets the overflow trigger sit between the first crumb and the rest.
  static shadowRootOptions: ShadowRootInit = {
    ...BitElement.shadowRootOptions,
    slotAssignment: "manual",
  };

  static styles = [
    BitElement.styles,
    css`
      :host {
        display: flex;
        align-items: center;
        width: 100%;
        min-width: 0;
      }
    `,
  ];

  /** The size of the breadcrumb text and icons. */
  @property({ reflect: true }) size: BreadcrumbSize = "base";

  /**
   * Display an arrow after the last breadcrumb in the list.
   *
   * Intended to support usage of the breadcrumbs above our web header component. In this case, the
   * "active" breadcrumb is displayed as the header of the page, so showing an arrow after the last
   * breadcrumb provides better logical continuity of breadcrumbs -> header. Do not use this if the
   * active breadcrumb is actually passed as a breadcrumb to `bit-breadcrumbs`.
   */
  @property({ type: Boolean, attribute: "show-trailing-arrow" }) showTrailingArrow = false;

  @state() private crumbs: BitBreadcrumb[] = [];
  @state() private overflowState?: OverflowListState;
  @state() private hostWidth = 0;

  @query("[part=list]") private listEl!: HTMLElement;
  @query("slot.first") private firstSlot!: HTMLSlotElement;
  @query("slot.rest") private restSlot!: HTMLSlotElement;
  @query(".trigger") private triggerEl?: HTMLElement;
  @query("bit-menu") private menuEl?: BitMenu;

  private readonly internals = this.attachInternals();
  private readonly header = new ContextConsumer(
    this,
    headerContext,
    (context) => {
      this.unsubscribeHeader?.();
      this.unsubscribeHeader = context.subscribe(() => this.requestUpdate());
    },
    true,
  );
  private unsubscribeHeader?: () => void;
  private reportedPromoted?: boolean;
  private overflow?: OverflowListHandle;
  private stopObservingWidth?: () => void;
  private lastContainerWidth?: number | null;
  private observedActive?: Element;
  private readonly activeObserver = new ResizeObserver(() => this.reportTitleSuffixOffset());
  private readonly startClones = new WeakMap<Element, Node>();
  private readonly childObserver = new MutationObserver(() => this.syncCrumbs());

  constructor() {
    super();
    this.internals.role = "navigation";
    this.addEventListener(BREADCRUMB_CHANGE_EVENT, () => this.requestUpdate());
  }

  connectedCallback() {
    super.connectedCallback();
    this.internals.ariaLabel = t("breadcrumbs");
    this.childObserver.observe(this, { childList: true, subtree: true, characterData: true });
    this.syncCrumbs();
    if (this.hasUpdated) {
      this.attach();
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.childObserver.disconnect();
    this.detach();
    this.activeObserver.disconnect();
    this.observedActive = undefined;
    this.header.value?.setTitleSuffixOffset(this, undefined);
    this.unsubscribeHeader?.();
    this.unsubscribeHeader = undefined;
    this.header.value?.unregisterPromotedHeading(this);
    this.reportedPromoted = undefined;
  }

  private syncCrumbs() {
    const next = Array.from(this.children).filter(
      (el): el is BitBreadcrumb => el.localName === "bit-breadcrumb",
    );
    if (next.length !== this.crumbs.length || next.some((crumb, i) => crumb !== this.crumbs[i])) {
      this.crumbs = next;
    } else {
      // Label text changed.
      this.overflow?.remeasure();
      this.requestUpdate();
    }
  }

  /**
   * Width handed to the overflow list. Derived from the host rather than letting the list observe
   * itself: the list is content-sized (it shrinks as items hide), which would feed the packing
   * decision back into its own input. Reserves room for the trailing arrow and, while promoted,
   * for the header's title suffix that follows the heading.
   */
  private get availableWidth() {
    const arrowReserve = this.showTrailingArrow ? TRAILING_ARROW_RESERVE_PX[this.size] : 0;
    const suffixWidth = this.promoted ? (this.header.value?.titleSuffixWidth ?? 0) : 0;
    const suffixReserve = suffixWidth > 0 ? suffixWidth + TITLE_SUFFIX_GAP_PX : 0;
    return Math.max(0, this.hostWidth - arrowReserve - suffixReserve);
  }

  private syncContainerWidth() {
    const width = this.availableWidth || null;
    if (width !== this.lastContainerWidth) {
      this.lastContainerWidth = width;
      this.overflow?.update({ containerWidth: width });
    }
  }

  /** Tells `bit-header` where the promoted heading ends, so its title suffix can follow it. */
  private reportTitleSuffixOffset() {
    const context = this.header.value;
    if (!context) {
      return;
    }
    const heading = this.promoted ? this.activeCrumb?.ariaTarget : undefined;
    if (!heading) {
      context.setTitleSuffixOffset(this, undefined);
      return;
    }
    const host = this.getBoundingClientRect();
    const rect = heading.getBoundingClientRect();
    const rtl = getComputedStyle(this).direction === "rtl";
    context.setTitleSuffixOffset(
      this,
      Math.round(rtl ? host.right - rect.left : rect.right - host.left),
    );
  }

  private get activeCrumb() {
    return this.crumbs.find((crumb) => crumb.current);
  }

  private get promoted() {
    return !!this.header.value?.promoteActiveBreadcrumb && this.activeCrumb != null;
  }

  private attach() {
    this.detach();
    this.stopObservingWidth = observeWidth(this, (width) => (this.hostWidth = width));
    this.overflow = attachOverflowList(this.listEl, {
      items: () => this.crumbs,
      trigger: () => this.triggerEl,
      strategy: "middle",
      containerWidth: (this.lastContainerWidth = this.availableWidth || null),
      onChange: (next) => (this.overflowState = next),
    });
  }

  private detach() {
    this.stopObservingWidth?.();
    this.stopObservingWidth = undefined;
    this.overflow?.destroy();
    this.overflow = undefined;
  }

  protected willUpdate() {
    const promoted = this.promoted;
    this.crumbs.forEach((crumb, i) => {
      crumb.size = this.size;
      crumb.separator = i > 0;
      crumb.heading = promoted && crumb === this.activeCrumb;
    });
  }

  protected firstUpdated() {
    this.attach();
    // The menu trigger directive needs the rendered menu.
    this.requestUpdate();
  }

  protected updated(changed: PropertyValues) {
    if (changed.has("crumbs")) {
      this.firstSlot.assign(...this.crumbs.slice(0, 1));
      this.restSlot.assign(...this.crumbs.slice(1));
    }
    // Also re-run on header context changes, which may carry a new title suffix width.
    this.syncContainerWidth();
    // `size` swaps crumb typography and separator margins, so cached item widths go stale.
    if (changed.has("size") && changed.get("size") !== undefined) {
      void Promise.all(this.crumbs.map((crumb) => crumb.updateComplete)).then(() =>
        this.overflow?.remeasure(),
      );
    }

    const promoted = this.promoted;
    if (this.header.value && promoted !== this.reportedPromoted) {
      this.reportedPromoted = promoted;
      this.header.value.setPromotedHeading(this, promoted);
    }

    const active = promoted ? this.activeCrumb : undefined;
    if (active !== this.observedActive) {
      this.activeObserver.disconnect();
      this.observedActive = active;
      if (active) {
        this.activeObserver.observe(active);
      }
    }
    void Promise.all(this.crumbs.map((crumb) => crumb.updateComplete)).then(() =>
      this.reportTitleSuffixOffset(),
    );
  }

  private startClone(el: Element): Node {
    let clone = this.startClones.get(el);
    if (!clone) {
      clone = el.cloneNode(true);
      if (el.localName === "bit-icon-tile") {
        (clone as BitIconTile).size = "xs";
      }
      this.startClones.set(el, clone);
    }
    return clone;
  }

  private renderMenuItem(crumb: BitBreadcrumb) {
    const content = html`${crumb.startElements.map((el) => this.startClone(el))}
    ${crumb.icon ? html`<bit-icon slot="start" name=${crumb.icon}></bit-icon>` : nothing}
    ${crumb.label}`;
    return crumb.href
      ? html`<bit-menu-item href=${crumb.href}>${content}</bit-menu-item>`
      : html`<bit-menu-item @click=${() => crumb.activate()}>${content}</bit-menu-item>`;
  }

  render() {
    const state = this.overflowState;
    const ready = state?.ready ?? false;
    const firstDisplayed = state ? state.displayed.includes(0) : true;
    const overflow = state?.overflow ?? [];

    /*
      The "middle" strategy anchors the first and last crumbs and collapses the run between them
      into the "More" menu, rendering `First > … > survivors > Current`. Separators live inside each
      crumb/trigger so they hide along with their owner. `overflow-x-clip` (not `overflow-hidden`)
      keeps focus rings visible vertically; the padding / negative-margin pair gives them room
      horizontally, cancelling out so the measured content-box width still matches the width
      packing runs against.
    */
    return html`<div
        part="list"
        class="-tw-ms-0.5 -tw-me-0.5 tw-flex tw-min-w-0 tw-flex-1 tw-flex-nowrap tw-items-center tw-overflow-x-clip tw-pe-0.5 tw-ps-0.5 ${
          ready ? "" : "tw-invisible"
        }"
      >
        <slot class="first"></slot>
        ${
          this.crumbs.length > 0
            ? html`<span class="trigger tw-flex tw-shrink-0 tw-items-center">
                ${firstDisplayed ? breadcrumbArrow(this.size) : nothing}
                <bit-icon-button
                  icon="bwi-ellipsis-h"
                  size="small"
                  label=${t("moreBreadcrumbs")}
                  ${menuTrigger(this.menuEl)}
                ></bit-icon-button>
              </span>`
            : nothing
        }
        <slot class="rest"></slot>
        ${this.showTrailingArrow ? breadcrumbArrow(this.size) : nothing}
      </div>
      <bit-menu
        >${overflow
          .map((i) => this.crumbs[i])
          .filter(Boolean)
          .map((crumb) => this.renderMenuItem(crumb))}</bit-menu
      >`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bit-breadcrumbs": BitBreadcrumbs;
  }
}
