import { css, html, nothing, PropertyValues } from "lit";
import { customElement, property, query, state } from "lit/decorators.js";

import { AriaTargetHost } from "../core/aria";
import { BitElement } from "../core/bit-element";
import type { BitwardenIcon } from "../icon/shared-icon";
import { attachTooltip, TooltipHandle } from "../tooltip/attach-tooltip";
import "../icon/icon";

/**
 * A toolbar button styled for the dark bulk actions bar. Renders a link when `href` is set. In
 * `compact` mode only the icon shows; the label becomes the tooltip and accessible name.
 *
 * Used by `bit-bulk-actions-bar` for its own buttons.
 *
 * @slot - Label.
 */
@customElement("bit-bulk-action-button")
export class BitBulkActionButton extends BitElement implements AriaTargetHost {
  static styles = [
    BitElement.styles,
    css`
      :host {
        display: inline-flex;
        /* Never shrink below the natural width: the bar's overflow packing measures it. */
        flex-shrink: 0;
      }
    `,
  ];

  @property() icon!: BitwardenIcon;

  /** Show only the icon; the label moves to a tooltip and `aria-label`. */
  @property({ type: Boolean, reflect: true }) compact = false;

  @property({ type: Boolean, reflect: true }) disabled = false;

  @property() href?: string;

  /**
   * Tab index of the inner button. The bar sets it for its roving tabindex, so only the active
   * item is in the tab order.
   */
  @property({ type: Number, attribute: false }) focusTabIndex = 0;

  @state() private labelText = "";

  @query("[part=base]") private baseEl?: HTMLElement;
  @query(".label") private labelEl?: HTMLElement;

  private tooltipHandle?: TooltipHandle;

  get ariaTarget(): HTMLElement | null {
    return this.baseEl ?? null;
  }

  connectedCallback() {
    super.connectedCallback();
    this.tooltipHandle = attachTooltip(this, { content: this.tooltipContent });
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.tooltipHandle?.destroy();
    this.tooltipHandle = undefined;
  }

  /** Hide the tooltip and keep it from opening, e.g. while this button's menu is open. */
  setTooltipSuppressed(suppressed: boolean) {
    this.tooltipHandle?.setSuppressed(suppressed);
  }

  focus(options?: FocusOptions) {
    // focusVisible is not yet in TypeScript's FocusOptions but is supported in all modern browsers
    this.baseEl?.focus({ focusVisible: true, ...options } as FocusOptions);
  }

  /**
   * Overrides the label's `display` so the bar can read the full-label intrinsic width even while
   * compact. Call with `false` to clear the override.
   * @internal
   */
  forceLabelVisible(visible: boolean) {
    if (this.labelEl) {
      this.labelEl.style.display = visible ? "inline" : "";
    }
  }

  private get tooltipContent() {
    return this.compact ? this.labelText : "";
  }

  protected updated(changed: PropertyValues) {
    if (changed.has("compact") || changed.has("labelText")) {
      this.tooltipHandle?.update({ content: this.tooltipContent });
    }
  }

  private onSlotChange(event: Event) {
    const slot = event.target as HTMLSlotElement;
    this.labelText = slot
      .assignedNodes({ flatten: true })
      .map((node) => node.textContent ?? "")
      .join("")
      .trim();
  }

  render() {
    const classes = [
      "tw-inline-flex",
      "tw-items-center",
      "tw-gap-2",
      "tw-shrink-0",
      ...(this.compact ? ["tw-p-2"] : ["tw-px-3", "tw-py-2"]),
      "tw-text-sm",
      "tw-font-[inherit]",
      "!tw-text-fg-contrast",
      "!tw-no-underline",
      "tw-bg-transparent",
      "tw-border-none",
      "tw-cursor-pointer",
      "tw-rounded-lg",
      "hover:tw-bg-bg-hover-contrast",
      "focus-visible:tw-bg-bg-hover-contrast",
      "focus-visible:tw-outline-none",
      "focus-visible:tw-ring-2",
      "focus-visible:tw-ring-inset",
      "focus-visible:tw-ring-border-focus-contrast",
      "disabled:!tw-text-fg-inactive",
      "disabled:tw-cursor-default",
      "disabled:hover:tw-bg-transparent",
      "aria-disabled:!tw-text-fg-inactive",
      "aria-disabled:tw-cursor-default",
      "aria-disabled:hover:tw-bg-transparent",
    ].join(" ");
    const ariaLabel = this.compact && this.labelText ? this.labelText : nothing;
    const content = html`<bit-icon
        name=${this.icon}
        class="tw-leading-none ${this.compact ? "tw-text-lg" : ""}"
      ></bit-icon>
      <span class="label ${this.compact ? "tw-hidden" : ""}"
        ><slot @slotchange=${this.onSlotChange}></slot
      ></span>`;

    if (this.href) {
      return html`<a
        part="base"
        class=${classes}
        href=${this.disabled ? nothing : this.href}
        tabindex=${this.focusTabIndex}
        aria-disabled=${this.disabled ? "true" : nothing}
        aria-label=${ariaLabel}
        >${content}</a
      >`;
    }
    return html`<button
      part="base"
      type="button"
      class=${classes}
      tabindex=${this.focusTabIndex}
      ?disabled=${this.disabled}
      aria-label=${ariaLabel}
    >
      ${content}
    </button>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bit-bulk-action-button": BitBulkActionButton;
  }
}
