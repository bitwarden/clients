import { css, html, nothing, PropertyValues } from "lit";
import { customElement, property } from "lit/decorators.js";

import { BitButtonBase } from "../button/button-base";
import { ButtonType, getButtonColorStyles } from "../button/button-styles";
import { BitElement } from "../core/bit-element";
import { BitwardenIcon } from "../icon/shared-icon";
import "../spinner/spinner";
import { attachTooltip, TooltipHandle, TooltipPosition } from "../tooltip/attach-tooltip";

export type IconButtonSize = "default" | "xsmall" | "small" | "large";

const sizeStyles: Record<IconButtonSize, string> = {
  xsmall: "tw-text-xl tw-size-6 tw-rounded",
  small: "tw-text-xl tw-size-8 tw-rounded-xl",
  default: "tw-text-2xl tw-size-10 tw-rounded-xl",
  large: "tw-text-[2rem] tw-size-11 tw-rounded-xl",
};

/**
 * Button with only an icon. `label` is required: it's the accessible name and the default tooltip.
 */
@customElement("bit-icon-button")
export class BitIconButton extends BitButtonBase {
  static styles = [
    BitElement.styles,
    css`
      :host {
        display: inline-block;
        vertical-align: middle;
        flex-shrink: 0;
      }
    `,
  ];

  @property({ reflect: true }) icon!: BitwardenIcon;

  /** Accessible name. Also shown as a tooltip unless `tooltip` is set. */
  @property() label!: string;

  @property({ attribute: "button-type", reflect: true }) buttonType: ButtonType = "primaryGhost";

  @property({ reflect: true }) size: IconButtonSize = "default";

  /** Tooltip text. Defaults to `label`; set to `""` to disable. */
  @property() tooltip?: string;

  @property({ attribute: "tooltip-position" }) tooltipPosition: TooltipPosition = "above-center";

  private tooltipHandle?: TooltipHandle;

  connectedCallback() {
    super.connectedCallback();
    this.tooltipHandle = attachTooltip(this, this.tooltipOptions);
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

  private get tooltipOptions() {
    return { content: this.tooltip ?? this.label ?? "", position: this.tooltipPosition };
  }

  protected updated(changed: PropertyValues<this>) {
    super.updated(changed);
    if (changed.has("tooltip") || changed.has("label") || changed.has("tooltipPosition")) {
      this.tooltipHandle?.update(this.tooltipOptions);
    }
  }

  render() {
    const classes = [
      "tw-relative tw-inline-block tw-align-middle tw-shrink-0",
      sizeStyles[this.size],
      ...getButtonColorStyles({
        buttonType: this.buttonType,
        isDisabled: this.showSpinner || this.isInactive,
      }),
    ].join(" ");

    return html`<button
      part="base"
      type="button"
      class=${classes}
      aria-label=${this.label ?? nothing}
      aria-disabled=${this.isInactive ? "true" : nothing}
      @click=${this.onClick}
    >
      <span
        class="tw-absolute tw-top-[50%] tw-left-[50%] tw-translate-x-[-50%] tw-translate-y-[-50%] tw-leading-[0px]"
      >
        ${
          this.showSpinner
            ? html`<bit-spinner size=${this.size === "small" ? "sm" : "md"}></bit-spinner>`
            : html`<i class="bwi ${this.icon} !tw-m-0" aria-hidden="true"></i>`
        }
      </span>
    </button>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bit-icon-button": BitIconButton;
  }
}
