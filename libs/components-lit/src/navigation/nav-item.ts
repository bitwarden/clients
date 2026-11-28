import { ContextConsumer } from "@lit/context";
import { css, html, nothing, PropertyValues, TemplateResult } from "lit";
import { customElement, property, query, state } from "lit/decorators.js";
import { styleMap } from "lit/directives/style-map.js";

import { AriaTargetHost } from "../core/aria";
import { BitElement } from "../core/bit-element";
import type { BitwardenIcon } from "../icon/shared-icon";
import { tooltip } from "../tooltip/tooltip-directive";

import {
  navGroupContext,
  NavGroupParent,
  NavToggleScope,
  navToggleScopeContext,
  SlotAssignController,
  SubscribedContextConsumer,
} from "./nav-context";
import { SideNavStateController } from "./side-nav-state";
import "../icon/icon";

/**
 * Utility classes for the focus-visible-within ring. Exported so snapshot stories can force the
 * focused state directly — focus-visible-within is JS-driven and has no CSS variant to trigger —
 * without duplicating (and drifting from) the class list.
 */
export const FVW_RING_CLASSES =
  "tw-z-10 tw-rounded tw-outline-none tw-ring tw-ring-border-nav-focus tw-bg-bg-nav-hover";

/** The legacy design keeps the inset ring; the outset ring above is a VFO1 design change. */
export const FVW_RING_CLASSES_V1 =
  "tw-z-10 tw-rounded tw-outline-none tw-ring tw-ring-inset tw-ring-border-nav-focus tw-bg-bg-nav-hover";

export type AriaCurrentValue = "page" | "step" | "location" | "date" | "time" | "true" | "false";

/** Base padding for nav items (in rem), before depth-based padding. */
const TREE_BASE_PADDING = 2.25;

/** Padding added per tree depth level (in rem) to indicate hierarchy. */
const TREE_DEPTH_PADDING = 1.5;

const INTERACTIVE_CLASS =
  "tw-size-full tw-px-0 tw-block tw-truncate tw-border-none tw-bg-transparent !tw-text-fg-nav tw-text-start tw-no-underline hover:tw-no-underline focus:tw-outline-none [&_i]:tw-leading-[1.5rem]";

const INTERACTIVE_SELECTOR = "a, button, input, select, textarea, [role='button']";

/**
 * A row in the side navigation. Renders a link when `href` is set, otherwise a button.
 *
 * @slot start - Leading content (e.g. a collapse toggle), shown while the side nav is open.
 * @slot end - Trailing content such as action buttons, badges or counts, shown while open.
 * @slot icon-tile - A `bit-icon-tile` (assigned automatically by tag) used as the leading glyph and
 * the collapsed-rail glyph. VFO1 design only.
 * @fires mainContentClicked - The row (not an `end` control) was clicked.
 * @csspart container - The row container, e.g. for forcing interaction states in stories.
 */
@customElement("bit-nav-item")
export class BitNavItem extends BitElement implements AriaTargetHost {
  static shadowRootOptions: ShadowRootInit = {
    ...BitElement.shadowRootOptions,
    delegatesFocus: true,
    slotAssignment: "manual",
  };

  static styles = [
    BitElement.styles,
    css`
      :host {
        display: block;
      }
      /* Story hook for forcing the hover state, matching libs/components. */
      :host(.tw-test-hover) [part="container"] {
        background-color: var(--color-nav-bg-brand-hover);
      }
    `,
  ];

  /** Text to display in main content. */
  @property() text?: string;

  /** `aria-label` for main content. Defaults to `text`. */
  @property() label?: string;

  /** Optional icon, e.g. `"bwi-collection-shared"`. */
  @property() icon?: BitwardenIcon;

  /** Link target. When unset the item renders as a button. Replaces Angular's `route`. */
  @property() href?: string;

  /** Passed to the link's `target`. */
  @property() target?: string;

  /**
   * Whether `href` is the current page. Replaces `routerLinkActive`: the app decides what matches
   * (exact or subset). An active item opens its ancestor nav groups.
   */
  @property({ type: Boolean, reflect: true }) active = false;

  /** Depth level. Set automatically from enclosing `bit-nav-group`s. */
  @property({ type: Number, attribute: "tree-depth" }) treeDepth = 0;

  /** If `true`, do not change styles when the item is active. */
  @property({ type: Boolean, attribute: "hide-active-styles" }) hideActiveStyles = false;

  /** Forces active styles to be shown, regardless of `active`. */
  @property({ type: Boolean, attribute: "force-active-styles" }) forceActiveStyles = false;

  /**
   * `aria-current` value while `active`. Useful for nav groups that navigate to their first child
   * page and should not be marked current while the child is.
   */
  @property({ attribute: "aria-current-when-active" })
  ariaCurrentWhenActive?: AriaCurrentValue = "page";

  /**
   * Where focus should go after navigating: a selector, or `false` to keep it on the item. Not
   * acted on here — reflected for the app's router focus management to read from the clicked item.
   */
  @property({ attribute: "focus-after-nav", reflect: true }) focusAfterNav?: string;

  /** @internal Unconditional `aria-current`, set by a composing nav group. */
  @property({ attribute: false }) ariaCurrentValue?: AriaCurrentValue;

  /** @internal `aria-expanded` when a composing nav group's row toggles its content. */
  @property({ attribute: false }) rowExpanded?: boolean;

  /** @internal The region a composing nav group's row expands/collapses. */
  @property({ attribute: false }) rowControls?: HTMLElement;

  /** @internal Set by a composing nav group when it forwards an icon tile into this item. */
  @property({ attribute: false }) hasForwardedIconTile = false;

  /** @internal Set by a composing nav group, whose row aligns with its parent's toggle scope. */
  @property({ attribute: false }) reserveStartSlotOverride?: boolean;

  @state() private focusVisibleWithin = false;
  @state() private ownIconTile = false;
  @state() private endFilled = false;
  @state() private endHasButton = false;

  @query("[data-fvw]") private interactive?: HTMLElement;

  private readonly nav = new SideNavStateController(this);
  private parentGroup?: NavGroupParent;
  private readonly parentConsumer = new ContextConsumer(
    this,
    navGroupContext,
    (parent) => {
      this.parentGroup = parent;
      if (this.active) {
        parent.setOpen(true);
      }
    },
    true,
  );
  private readonly toggleScope = new SubscribedContextConsumer<NavToggleScope>(
    this,
    navToggleScopeContext,
  );

  private readonly slots = new SlotAssignController(this, { "icon-tile": "bit-icon-tile" }, () => {
    // A nav group forwards its tile through a <slot> and reports it via `hasForwardedIconTile`.
    const hasTile = this.slots
      .nodesFor("icon-tile")
      .some((node) => !(node instanceof HTMLSlotElement));
    if (hasTile !== this.ownIconTile) {
      this.ownIconTile = hasTile;
    }
  });

  get ariaTarget(): HTMLElement | null {
    return this.interactive ?? null;
  }

  /** Effective depth: one below the enclosing nav group, else `treeDepth`. */
  get depth(): number {
    return this.parentConsumer.value ? this.parentConsumer.value.depth + 1 : this.treeDepth;
  }

  connectedCallback() {
    super.connectedCallback();
    this.setAttribute("data-spotlight-host", "");
  }

  protected updated(changed: PropertyValues<this>) {
    super.updated(changed);
    if (changed.has("active") && this.active) {
      this.parentGroup?.setOpen(true);
    }
    const target = this.interactive as
      (HTMLElement & { ariaControlsElements?: Element[] | null }) | undefined;
    if (target) {
      target.ariaControlsElements = this.rowControls ? [this.rowControls] : null;
    }
  }

  private get hasStartIconTile() {
    return this.hasForwardedIconTile || this.ownIconTile;
  }

  private get showActiveStyles() {
    return this.forceActiveStyles || (this.active && !this.hideActiveStyles);
  }

  private get currentValue() {
    return this.ariaCurrentValue ?? (this.active ? this.ariaCurrentWhenActive : undefined);
  }

  /** Depth 2+ always reserves the start slot so rows indent beneath their parent's toggle. */
  private get reserveStartSlot() {
    return (
      this.reserveStartSlotOverride ?? (this.depth > 1 || !!this.toggleScope.value?.hasStartToggle)
    );
  }

  private get fvwClasses() {
    if (!this.focusVisibleWithin && !this.classList.contains("tw-test-focus-visible")) {
      return "";
    }
    return this.nav.state.version === "vfo1" ? FVW_RING_CLASSES : FVW_RING_CLASSES_V1;
  }

  /**
   * The design calls for an outline around the whole row when the anchor/button has
   * :focus-visible. :focus-within would also match plain :focus, and there is no
   * :focus-visible-within (WICG/focus-visible#151), so check the focus target ourselves.
   */
  private onFocusIn(event: FocusEvent) {
    this.focusVisibleWithin = (event.target as HTMLElement).matches("[data-fvw]:focus-visible");
  }

  private onFocusOut() {
    this.focusVisibleWithin = false;
  }

  private emitMainContentClicked() {
    this.dispatchEvent(new CustomEvent("mainContentClicked", { bubbles: true, composed: true }));
  }

  /**
   * Routes clicks in the trailing `end` slot: clicks on a control (e.g. a consumer action button)
   * stay contained and don't trigger the row, while clicks on decorative content — like a nav
   * group's collapse chevron — behave like a click on the row itself.
   */
  private onEndSlotClick(event: MouseEvent) {
    const container = event.currentTarget as HTMLElement;
    const path = event.composedPath();
    const interactive = path
      .slice(0, path.indexOf(container))
      .some(
        (node) =>
          node instanceof Element && (node.matches(INTERACTIVE_SELECTOR) || "ariaTarget" in node),
      );
    if (interactive) {
      event.stopPropagation();
    } else {
      this.emitMainContentClicked();
    }
  }

  private onEndSlotChange(event: Event) {
    const nodes = (event.target as HTMLSlotElement).assignedNodes({ flatten: true });
    const elements = nodes.filter((node): node is Element => node instanceof Element);
    this.endFilled = elements.length > 0 || nodes.some((node) => !!node.textContent?.trim());
    this.endHasButton = elements.some((el) => el.matches("button, bit-icon-button, bit-button"));
  }

  private renderInteractive(open: boolean, content: TemplateResult, withTooltip: boolean) {
    const label = this.label || this.text;
    const tip = tooltip(withTooltip && !open ? (this.text ?? "") : "", {
      position: "right-center",
    });
    if (this.href) {
      return html`<a
        class=${INTERACTIVE_CLASS}
        data-fvw
        href=${this.href}
        target=${this.target ?? nothing}
        aria-label=${label ?? nothing}
        aria-expanded=${this.rowExpanded == null ? nothing : String(this.rowExpanded)}
        aria-current=${this.currentValue ?? nothing}
        @click=${this.emitMainContentClicked}
        data-testid="nav-item-interactive"
        ${tip}
        >${content}</a
      >`;
    }
    return html`<button
      type="button"
      class=${INTERACTIVE_CLASS}
      data-fvw
      aria-label=${(withTooltip ? label : undefined) ?? nothing}
      aria-expanded=${this.rowExpanded == null ? nothing : String(this.rowExpanded)}
      aria-current=${this.currentValue ?? nothing}
      @click=${this.emitMainContentClicked}
      data-testid="nav-item-interactive"
      ${tip}
    >
      ${content}
    </button>`;
  }

  private renderEnd(open: boolean, legacy: boolean) {
    if (!open) {
      return nothing;
    }
    const slot = html`<slot name="end" @slotchange=${this.onEndSlotChange}></slot>`;
    if (legacy) {
      return html`<div
        class="tw-flex tw-items-center tw-gap-1 ${this.endHasButton ? "tw-pe-2" : "tw-pe-3"}"
        ?hidden=${!this.endFilled}
        @click=${(event: Event) => event.stopPropagation()}
      >
        ${slot}
      </div>`;
    }
    return html`<div
      class="tw-flex tw-items-center tw-pe-2 tw-gap-1 tw-self-stretch"
      ?hidden=${!this.endFilled}
      @click=${this.onEndSlotClick}
    >
      ${slot}
    </div>`;
  }

  private renderLegacy(open: boolean) {
    const active = this.showActiveStyles;
    const content = html`<div
      title=${this.text ?? nothing}
      class="tw-gap-2 tw-py-0 tw-flex tw-items-center tw-h-full ${
        open ? "" : "tw-text-center tw-justify-center"
      } ${active ? "tw-font-semibold" : "tw-font-normal"}"
    >
      ${
        this.icon
          ? html`<bit-icon
              class="!tw-m-0 tw-w-4 tw-shrink-0"
              name=${this.icon}
              fixed-width
              aria-hidden=${open ? "true" : nothing}
              label=${(open ? undefined : this.text) ?? nothing}
            ></bit-icon>`
          : nothing
      }
      ${open ? html`<span class="tw-truncate">${this.text}</span>` : nothing}
    </div>`;

    return html`<div class="tw-cursor-pointer tw-ps-3 tw-pe-3">
      ${
        open || this.icon
          ? html`<div
              part="container"
              class="tw-relative tw-rounded-xl tw-h-10 tw-bg-bg-nav hover:tw-bg-bg-nav-hover ${
                this.fvwClasses
              }"
              style=${styleMap({
                paddingInlineStart: open
                  ? `${TREE_BASE_PADDING + this.depth * TREE_DEPTH_PADDING}rem`
                  : "0",
                "--color-nav-bg-brand": active ? "var(--color-nav-bg-primary-strong)" : undefined,
                "--color-nav-bg-brand-hover": active
                  ? "var(--color-nav-bg-primary-hover-strong)"
                  : undefined,
              })}
              data-testid="nav-item-container"
              data-spotlight-target
            >
              <div class="tw-relative tw-flex tw-items-center tw-h-full">
                ${
                  open
                    ? html`<div
                        class="tw-absolute tw-left-[0px] tw-transform tw--translate-x-[calc(100%_+_4px)]"
                      >
                        <slot name="start"></slot>
                      </div>`
                    : nothing
                }
                ${this.renderInteractive(open, content, false)} ${this.renderEnd(open, true)}
              </div>
            </div>`
          : nothing
      }
    </div>`;
  }

  private renderVfo1(open: boolean) {
    const active = this.showActiveStyles;
    const hasTile = this.hasStartIconTile;
    // Native title covers the truncated label when open; collapsed, the tooltip owns it and a
    // lingering title would show a second, unthemed tooltip behind ours.
    const content = html`<div
      title=${(open ? this.text : undefined) ?? nothing}
      class="tw-py-2 tw-pe-2 tw-flex tw-items-center tw-h-full ${
        open ? "" : "tw-ps-2 tw-text-center tw-justify-center"
      } ${hasTile ? "tw-gap-1" : ""} ${active ? "tw-font-semibold" : "tw-font-normal"}"
    >
      <slot name="icon-tile"></slot>
      ${
        this.icon && !hasTile
          ? html`<div class="tw-size-6 tw-shrink-0 tw-flex tw-items-center tw-justify-center">
              <bit-icon
                class="!tw-m-0 tw-text-lg tw-shrink-0"
                name=${this.icon}
                aria-hidden=${open ? "true" : nothing}
                label=${(open ? undefined : this.text) ?? nothing}
              ></bit-icon>
            </div>`
          : nothing
      }
      ${open ? html`<span class="tw-truncate tw-ps-1">${this.text}</span>` : nothing}
    </div>`;

    const depth = this.depth;
    return html`<div class="tw-cursor-pointer">
      ${
        open || this.icon || hasTile
          ? html`<div
              part="container"
              class="tw-relative tw-rounded-xl tw-bg-bg-nav hover:tw-bg-bg-nav-hover ${
                this.fvwClasses
              } ${open ? "" : "tw-max-w-10 tw-mx-auto"}"
              style=${styleMap({
                "--color-nav-bg-brand": active ? "var(--color-nav-bg-brand-soft)" : undefined,
              })}
              data-testid="nav-item-container"
              data-spotlight-target
            >
              <div class="tw-relative tw-flex tw-items-center tw-h-full">
                ${
                  open
                    ? html`<div
                        class="tw-shrink-0 ${this.reserveStartSlot ? "tw-w-8 tw-flex" : "tw-ps-2"}"
                        style=${styleMap({
                          marginInlineStart:
                            depth > 1 ? `${(depth - 1) * TREE_DEPTH_PADDING}rem` : undefined,
                        })}
                      >
                        <slot name="start"></slot>
                      </div>`
                    : nothing
                }
                ${this.renderInteractive(open, content, true)} ${this.renderEnd(open, false)}
              </div>
            </div>`
          : nothing
      }
    </div>`;
  }

  render() {
    const { open, version } = this.nav.state;
    return html`<div @focusin=${this.onFocusIn} @focusout=${this.onFocusOut}>
      ${version === "default" ? this.renderLegacy(open) : this.renderVfo1(open)}
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bit-nav-item": BitNavItem;
  }
}
