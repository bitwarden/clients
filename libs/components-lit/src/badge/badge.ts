import { css, html, nothing, PropertyValues } from "lit";
import { customElement, property } from "lit/decorators.js";

import { BitElement } from "../core/bit-element";
import "../icon/icon";
import { BitwardenIcon } from "../icon/shared-icon";
import { attachTooltip, TooltipHandle, TooltipPosition } from "../tooltip/attach-tooltip";

/**
 * @deprecated Use 'primary' instead. This variant will be removed in a future version.
 */
export type LegacyInfoVariant = "info";

/**
 * @deprecated Use 'subtle' instead. This variant will be removed in a future version.
 */
export type LegacySecondaryVariant = "secondary";

export type BadgeVariant =
  | "primary"
  | "subtle"
  | "success"
  | "danger"
  | "warning"
  | "accent-primary"
  | LegacyInfoVariant
  | LegacySecondaryVariant;

export type BadgeSize = "small" | "large";

const variantStyles: Record<BadgeVariant, string> = {
  primary: "tw-bg-bg-brand-softer tw-border-border-brand-soft tw-text-fg-brand-strong",
  info: "tw-bg-bg-brand-softer tw-border-border-brand-soft tw-text-fg-brand-strong",
  subtle: "tw-bg-bg-secondary tw-border-border-base tw-text-fg-body",
  secondary: "tw-bg-bg-secondary tw-border-border-base tw-text-fg-body",
  success: "tw-bg-bg-success-soft tw-border-border-success-soft tw-text-fg-success-strong",
  warning: "tw-bg-bg-warning-soft tw-border-border-warning-soft tw-text-fg-warning-strong",
  danger: "tw-bg-bg-danger-soft tw-border-border-danger-soft tw-text-fg-danger-strong",
  "accent-primary":
    "tw-bg-bg-accent-primary-soft tw-border-border-accent-primary-soft tw-text-fg-accent-primary-strong",
};

const sizeStyles: Record<BadgeSize, { label: string; icon: string }> = {
  small: { label: "tw-text-xs/4 tw-px-1 tw-py-0.5", icon: "tw-text-sm/3" },
  large: { label: "tw-text-sm/5 tw-px-1.5 tw-py-1", icon: "tw-text-base/5" },
};

const defaultIconMap: Record<BadgeVariant, BitwardenIcon | null> = {
  info: null,
  subtle: null,
  secondary: null,
  primary: null,
  success: "bwi-check-circle",
  warning: "bwi-exclamation-triangle",
  danger: "bwi-error",
  "accent-primary": null,
};

/** Maps the `start-icon="none"` attribute to `null` (no icon, not even the variant default). */
const startIconConverter = {
  fromAttribute: (value: string | null) => (value === "none" ? null : (value ?? undefined)),
  toAttribute: (value: BitwardenIcon | null | undefined) => (value === null ? "none" : value),
};

/**
 * Badges are used as labels.
 *
 * Truncated badges show their full text in a tooltip. Set `tooltip` to show different text
 * instead.
 *
 * @slot - Badge text
 * @cssprop --bit-badge-max-width - Max width of the text when truncating. Defaults to ~25ch.
 */
@customElement("bit-badge")
export class BitBadge extends BitElement {
  static styles = [
    BitElement.styles,
    css`
      :host {
        display: inline-flex;
      }
      .truncate-width {
        max-width: var(--bit-badge-max-width, calc(25ch - 0.5rem));
      }
    `,
  ];

  /** Visual variant that determines the badge's color scheme. */
  @property({ reflect: true }) variant: BadgeVariant = "primary";

  /** Determines the badge's padding and font size. */
  @property({ reflect: true }) size: BadgeSize = "large";

  /**
   * Don't truncate long text. By default text past `--bit-badge-max-width` is truncated with an
   * ellipsis and the full text is shown in a tooltip.
   */
  @property({ type: Boolean, attribute: "no-truncate" }) noTruncate = false;

  /**
   * Leading icon. Defaults to the variant's icon (success, warning, danger); set to `null`
   * (attribute `"none"`) to show no icon.
   */
  @property({ attribute: "start-icon", converter: startIconConverter })
  startIcon?: BitwardenIcon | null;

  /** Tooltip text. Overrides the default tooltip, which shows the badge text when truncating. */
  @property() tooltip?: string;

  @property({ attribute: "tooltip-position" }) tooltipPosition: TooltipPosition = "above-center";

  /** Add the tooltip to the badge's `aria-describedby`. */
  @property({ type: Boolean, attribute: "tooltip-described-by" }) tooltipDescribedBy = false;

  private tooltipHandle?: TooltipHandle;

  constructor() {
    super();
    // The text is slotted, so it can change without a property change. Resolve it right before
    // the tooltip shows; these run before the tooltip's own listeners.
    this.addEventListener("mouseenter", this.syncTooltip);
    this.addEventListener("focusin", this.syncTooltip);
  }

  connectedCallback() {
    super.connectedCallback();
    this.tooltipHandle = attachTooltip(this, this.tooltipOptions);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.tooltipHandle?.destroy();
    this.tooltipHandle = undefined;
  }

  protected updated(changed: PropertyValues<this>) {
    if (
      changed.has("tooltip") ||
      changed.has("noTruncate") ||
      changed.has("tooltipPosition") ||
      changed.has("tooltipDescribedBy")
    ) {
      this.syncTooltip();
    }
  }

  private get tooltipOptions() {
    const content = this.tooltip || (this.noTruncate ? "" : this.textContent?.trim() || "");
    return {
      content,
      position: this.tooltipPosition,
      describedBy: this.tooltipDescribedBy,
    };
  }

  private syncTooltip = () => {
    this.tooltipHandle?.update(this.tooltipOptions);
  };

  private get icon() {
    if (this.startIcon === null) {
      return null;
    }
    return this.startIcon || defaultIconMap[this.variant];
  }

  render() {
    const size = sizeStyles[this.size] ?? sizeStyles.large;
    const icon = this.icon;
    return html`<span
      part="base"
      class="tw-inline-flex tw-items-center tw-rounded-full tw-border tw-border-solid tw-font-medium tw-cursor-default tw-min-w-0 tw-max-w-full ${size.label} ${
        variantStyles[this.variant] ?? variantStyles.primary
      }"
    >
      <span class="tw-inline-flex tw-min-w-0 tw-w-full tw-max-w-full tw-items-center tw-gap-0.5">
        ${icon ? html`<bit-icon name=${icon} class=${size.icon}></bit-icon>` : nothing}
        <span
          class="tw-px-1 tw-text-start tw-min-w-0 tw-flex-1 ${
            this.noTruncate ? "" : "tw-truncate truncate-width"
          }"
          ><slot></slot
        ></span>
      </span>
    </span>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bit-badge": BitBadge;
  }
}
