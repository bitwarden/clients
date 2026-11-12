import { css, html, unsafeCSS } from "lit";
import { customElement, property } from "lit/decorators.js";

import { BitElement } from "../../core/bit-element";
import { t } from "../../core/i18n";
import { BitwardenIcon } from "../../icon/shared-icon";
import { renderChipContent, renderDismissButton } from "../shared/chip-content";
import { ChipSize, chipClasses, chipHostCss, testStateClasses } from "../shared/chip-styles";

/**
 * Chips represent user-provided values, entities, or selections that can be reviewed, edited, or
 * removed. Use input chips when users are entering or managing multiple discrete items, such as
 * tags, users, or permissions.
 *
 * The dismiss button is the chip's only control; `focus()` moves focus to it.
 *
 * @fires dismissed - The dismiss button was activated. Not fired while disabled.
 * @cssprop --bit-chip-max-width - Maximum width before the label truncates. Defaults to 13rem.
 */
@customElement("bit-chip")
export class BitChip extends BitElement {
  static shadowRootOptions = { ...BitElement.shadowRootOptions, delegatesFocus: true };

  static styles = [
    BitElement.styles,
    css`
      ${unsafeCSS(chipHostCss)}
    `,
  ];

  /** The label text for the chip. */
  @property() label = "";

  @property({ attribute: "start-icon" }) startIcon?: BitwardenIcon;

  @property({ reflect: true }) size: ChipSize = "large";

  @property({ type: Boolean, reflect: true }) disabled = false;

  /**
   * Accessible name for the dismiss button when it should differ from the label, e.g. when the
   * visible label leans on surrounding context.
   */
  @property({ attribute: "accessible-name" }) accessibleName?: string;

  private onDismiss = () => {
    this.dispatchEvent(new CustomEvent("dismissed", { bubbles: true, composed: true }));
  };

  render() {
    const dismiss = renderDismissButton({
      label: t("removeItem", this.accessibleName ?? this.label),
      size: this.size,
      disabled: this.disabled,
      onClick: this.onDismiss,
      classes: testStateClasses(this),
    });
    return html`<span
      class=${chipClasses({ size: this.size, hasTrailingIcon: true })}
      aria-disabled=${this.disabled ? "true" : "false"}
    >
      ${renderChipContent(this.label, { size: this.size, startIcon: this.startIcon, end: dismiss })}
    </span>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bit-chip": BitChip;
  }
}
