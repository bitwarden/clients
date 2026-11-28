import { Context, ContextConsumer, ContextEvent, ContextProvider } from "@lit/context";
import { css, html, nothing, PropertyValues } from "lit";
import { customElement, property, query, state } from "lit/decorators.js";

import { resolveAriaTarget, setAriaAttributes } from "../core/aria";
import { BitElement } from "../core/bit-element";
import { t } from "../core/i18n";
import { uniqueId } from "../core/ids";
import { hoverRevealBoundary } from "../hover-reveal/hover-reveal";
import type { BitwardenIcon } from "../icon/shared-icon";

import {
  navGroupContext,
  NavGroupParent,
  NavToggleScope,
  navToggleScopeContext,
  SlotAssignController,
  SubscribedContextConsumer,
} from "./nav-context";
import type { AriaCurrentValue, BitNavItem } from "./nav-item";
import { SideNavStateController } from "./side-nav-state";
import "../icon/icon";
import "../icon-button/icon-button";
import "./nav-item";

/** Story hooks forwarded to the row for forcing interaction states. */
const TEST_CLASSES = ["tw-test-hover", "tw-test-focus-visible"];

const NAV_CHILD_TAGS = new Set(["bit-nav-item", "bit-nav-group"]);

/**
 * An expandable group of nav items. Composes a `bit-nav-item` row with a collapse toggle; nest
 * groups for deeper trees.
 *
 * @slot - Nested `bit-nav-item`s, `bit-nav-group`s and `bit-nav-section`s.
 * @slot start - Leading content for VFO1 top-level groups (the toggle owns it otherwise).
 * @slot end - Trailing content such as action buttons, badges or counts.
 * @slot icon-tile - A `bit-icon-tile` (assigned by tag) used as the leading glyph of a VFO1
 * top-level group.
 * @fires mainContentClicked - The group's row was clicked.
 * @fires openChange - The group expanded or collapsed. `detail` is the new `open` value.
 */
@customElement("bit-nav-group")
export class BitNavGroup extends BitElement implements NavGroupParent {
  static shadowRootOptions: ShadowRootInit = {
    ...BitElement.shadowRootOptions,
    slotAssignment: "manual",
  };

  static styles = [
    BitElement.styles,
    css`
      :host {
        display: block;
      }
      /* Keeps child hover from revealing this group's row actions (see bit-hover-reveal-boundary). */
      .root:has(.children:hover) .row:not(:focus-within) {
        --bit-hover-reveal: 0;
      }
    `,
  ];

  /** Text to display in main content. */
  @property() text?: string;

  /** `aria-label` for main content. Defaults to `text`. */
  @property() label?: string;

  /** Optional icon, e.g. `"bwi-collection-shared"`. */
  @property() icon?: BitwardenIcon;

  /**
   * Link for the group's row. Ignored for VFO1 top-level groups, whose row only expands so that
   * opening a section doesn't navigate.
   */
  @property() href?: string;

  /** Passed to the link's `target`. */
  @property() target?: string;

  /** Whether `href` is the current page. An active group opens itself and its ancestors. */
  @property({ type: Boolean, reflect: true }) active = false;

  /** Whether the nested content is expanded. */
  @property({ type: Boolean, reflect: true }) open = false;

  /** Depth level. Set automatically from enclosing nav groups. */
  @property({ type: Number, attribute: "tree-depth" }) treeDepth = 0;

  /** Automatically hide the group if it has no nested nav items or groups. */
  @property({ type: Boolean, attribute: "hide-if-empty" }) hideIfEmpty = false;

  /** Forces active styles to be shown, regardless of `active`. */
  @property({ type: Boolean, attribute: "force-active-styles" }) forceActiveStyles = false;

  /** If `true`, do not change styles when the group is active. */
  @property({ type: Boolean, attribute: "hide-active-styles" }) hideActiveStyles = false;

  /** Does not toggle the expanded state on click. */
  @property({ type: Boolean, attribute: "disable-toggle-on-click" }) disableToggleOnClick = false;

  /**
   * `aria-current` while active. By default the group is `page` only while its children are
   * hidden (side nav or group collapsed), since an open group's active child carries it instead.
   * Pass `"page"` if the group navigates to its own page.
   */
  @property({ attribute: "aria-current-when-active" }) ariaCurrentWhenActive?: AriaCurrentValue;

  @state() private navChildCount = 0;
  @state() private hasStartSlotTile = false;

  @query(".children") private contentEl?: HTMLElement;
  @query("[data-toggle]") private toggleButton?: HTMLElement;
  @query("bit-nav-item") private row?: BitNavItem;

  private readonly contentId = uniqueId("bit-nav-group");
  private readonly nav = new SideNavStateController(this);
  private readonly ownScope = new NavToggleScope();
  private unregisterToggle?: () => void;
  private registeredScope?: NavToggleScope;

  private readonly parentConsumer = new ContextConsumer(this, {
    context: navGroupContext,
    subscribe: true,
  });
  private readonly parentScope = new SubscribedContextConsumer<NavToggleScope>(
    this,
    navToggleScopeContext,
  );

  private readonly slots = new SlotAssignController(this, { "icon-tile": "bit-icon-tile" }, () => {
    const count = Array.from(this.children).filter(
      (el) => NAV_CHILD_TAGS.has(el.localName) && !el.slot,
    ).length;
    if (count !== this.navChildCount) {
      this.navChildCount = count;
    }
    const hasTile = this.slots.nodesFor("icon-tile").length > 0;
    if (hasTile !== this.hasStartSlotTile) {
      this.hasStartSlotTile = hasTile;
    }
  });

  constructor() {
    super();
    new ContextProvider(this, navGroupContext, this as NavGroupParent);
    new ContextProvider(this, navToggleScopeContext, this.ownScope);
    this.ownScope.subscribe(() => this.requestUpdate());
  }

  /** Effective depth: one below the enclosing nav group, else `treeDepth`. */
  get depth(): number {
    return this.parentConsumer.value ? this.parentConsumer.value.depth + 1 : this.treeDepth;
  }

  /** Opens or closes the group. Opening also opens ancestor groups. */
  setOpen(open: boolean) {
    if (open !== this.open) {
      this.open = open;
      this.dispatchEvent(
        new CustomEvent("openChange", { detail: open, bubbles: true, composed: true }),
      );
    }
    if (open) {
      this.parentConsumer.value?.setOpen(true);
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.syncToggleRegistration(false);
  }

  private get legacy() {
    return this.nav.state.version === "default";
  }

  private get visible() {
    return !this.hideIfEmpty || this.navChildCount > 0;
  }

  /**
   * The collapse toggle sits at the far left (slot=start) for legacy groups at any depth and for
   * VFO1 nested groups. Only VFO1 top-level groups place it on the right.
   */
  private get toggleInStartSlot() {
    return this.legacy || this.depth > 0;
  }

  /** VFO1 top-level groups suppress their link to avoid navigating on expand. */
  private get effectiveHref() {
    return !this.legacy && this.depth === 0 ? undefined : this.href;
  }

  private get sideNavAndGroupOpen() {
    return this.open && this.nav.state.open;
  }

  /** True when this VFO1 top-level group's (suppressed) link is the current page. */
  private get routeIsActive() {
    return !this.legacy && this.depth === 0 && !!this.href && this.active;
  }

  private get parentHideActiveStyles() {
    return this.hideActiveStyles || this.sideNavAndGroupOpen;
  }

  private get currentValue(): AriaCurrentValue | undefined {
    return this.ariaCurrentWhenActive ?? (this.sideNavAndGroupOpen ? undefined : "page");
  }

  protected updated(changed: PropertyValues<this>) {
    super.updated(changed);
    if (changed.has("active") && this.active) {
      this.setOpen(true);
    }
    this.syncToggleRegistration(this.toggleInStartSlot && this.visible);
    const content = this.contentEl ?? null;
    if (this.row) {
      this.row.rowControls = this.toggleInStartSlot ? undefined : (content ?? undefined);
    }
    if (this.toggleButton) {
      void setAriaAttributes(this.toggleButton, { "aria-expanded": String(this.open) });
      void resolveAriaTarget(this.toggleButton).then((target) => {
        target.ariaControlsElements = content ? [content] : null;
      });
    }
  }

  private syncToggleRegistration(register: boolean) {
    const scope = register ? this.parentScope.value : undefined;
    if (scope === this.registeredScope) {
      return;
    }
    this.unregisterToggle?.();
    this.unregisterToggle = scope?.register();
    this.registeredScope = scope;
  }

  private toggle(event?: Event) {
    event?.stopPropagation();
    this.setOpen(!this.open);
  }

  private onRowClicked(event: Event) {
    event.stopPropagation();
    const state = this.nav.state;
    if (!state.open) {
      if (!this.effectiveHref) {
        state.open = true;
      }
      this.setOpen(true);
    } else if (!this.disableToggleOnClick) {
      this.toggle();
    }
    this.dispatchEvent(new CustomEvent("mainContentClicked", { bubbles: true, composed: true }));
  }

  /**
   * The row is a `bit-nav-item` in this shadow root, so its context requests would reach this
   * group's own providers. Like Angular's `viewProviders`, the row must align with the parent's
   * scope instead, which is passed in explicitly.
   */
  private onRowContextRequest(event: ContextEvent<Context<unknown, unknown>>) {
    if (event.context === navGroupContext || event.context === navToggleScopeContext) {
      event.stopPropagation();
    }
  }

  private renderChildren() {
    return html`<div
      id=${this.contentId}
      class="children tw-flex tw-flex-col ${this.legacy ? "" : "tw-gap-0.5"}"
      role="group"
      aria-label=${[this.text, t("submenu")].join(" ")}
      ${hoverRevealBoundary()}
    >
      <slot></slot>
    </div>`;
  }

  private renderContent() {
    if (!this.sideNavAndGroupOpen) {
      return nothing;
    }
    if (this.legacy) {
      return this.renderChildren();
    }
    const topLevel = this.depth === 0;
    // Magic number needed for visual consistency
    return html`<div class="tw-pt-1 ${topLevel ? "tw-ps-[19px]" : ""}">
      <div
        class="tw-flex tw-flex-col tw-gap-0.5 ${
          topLevel
            ? "tw-ps-3 tw-border-0 tw-border-s tw-border-solid tw-border-border-nav-divider"
            : ""
        }"
      >
        ${this.renderChildren()}
      </div>
    </div>`;
  }

  render() {
    if (!this.visible) {
      return nothing;
    }
    const toggleInStart = this.toggleInStartSlot;
    const parentHide = this.parentHideActiveStyles;
    const routeIsActive = this.routeIsActive;

    return html`<div class="root">
      <div class="row" @context-request=${this.onRowContextRequest}>
        <bit-nav-item
          class=${TEST_CLASSES.filter((c) => this.classList.contains(c)).join(" ")}
          .text=${this.text}
          .label=${this.label}
          .icon=${this.icon}
          .href=${this.effectiveHref}
          .target=${this.target}
          .active=${!!this.effectiveHref && this.active}
          .treeDepth=${this.depth}
          .hideActiveStyles=${parentHide}
          .ariaCurrentWhenActive=${this.currentValue}
          .forceActiveStyles=${this.forceActiveStyles || (routeIsActive && !parentHide)}
          .ariaCurrentValue=${routeIsActive ? this.currentValue : undefined}
          .rowExpanded=${toggleInStart ? undefined : this.open}
          .hasForwardedIconTile=${!toggleInStart && this.hasStartSlotTile}
          .reserveStartSlotOverride=${this.depth > 1 || !!this.parentScope.value?.hasStartToggle}
          @mainContentClicked=${this.onRowClicked}
        >
          ${
            toggleInStart
              ? html`<bit-icon-button
                  slot="start"
                  data-toggle
                  class="tw-ms-auto ${this.open ? "" : "tw-transform tw-rotate-[-90deg]"}"
                  icon="bwi-down-solid"
                  button-type="side-nav"
                  size="xsmall"
                  label=${[t("toggleCollapse"), this.text].join(" ")}
                  @click=${this.toggle}
                  data-testid="nav-group-collapse-arrow"
                ></bit-icon-button>`
              : html`<slot name="start" slot="start"></slot
                  ><slot name="icon-tile" slot="icon-tile"></slot>`
          }
          <slot name="end" slot="end"></slot>
          ${
            toggleInStart
              ? nothing
              : html`<bit-icon
                  slot="end"
                  class="tw-pointer-events-none ${
                    this.open ? "tw-transform tw-transition-transform tw-rotate-180" : ""
                  }"
                  name="bwi-angle-down"
                  aria-hidden="true"
                  data-testid="nav-group-collapse-arrow"
                ></bit-icon>`
          }
        </bit-nav-item>
      </div>
      ${this.renderContent()}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bit-nav-group": BitNavGroup;
  }
}
