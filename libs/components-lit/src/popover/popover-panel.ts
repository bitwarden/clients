import { html } from "lit";
import { customElement, property, query } from "lit/decorators.js";

import { BitPopoverBase } from "./popover-base";

/**
 * Minimal popover for overflow lists such as badge and chip groups. Meant for use inside the
 * component library; prefer `bit-popover`. Open it with `openPopover` or the attach functions.
 *
 * @slot - Content. Scrolls past 25rem.
 */
@customElement("bit-popover-panel")
export class BitPopoverPanel extends BitPopoverBase {
  /** Screen-reader name for the popover's dialog. */
  @property({ attribute: "accessible-name" }) accessibleName = "";

  /** Content padding: `default` is 24px, `compact` is 16px. */
  @property() padding: "default" | "compact" = "default";

  @query("[data-initial-focus]") private initialFocus!: HTMLElement;

  /** @internal */
  _focusInitial() {
    this.initialFocus?.focus();
  }

  render() {
    return this.renderShell(
      html`<div
        data-initial-focus
        class="[outline:none] tw-overflow-auto tw-max-h-[25rem] ${
          this.padding === "compact" ? "tw-p-4" : "tw-p-6"
        }"
        tabindex="0"
      >
        <slot></slot>
      </div>`,
      "has-[:focus-visible]:tw-outline tw-outline-border-focus tw-outline-2 tw-outline-offset-2 tw-rounded-xl",
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bit-popover-panel": BitPopoverPanel;
  }
}
