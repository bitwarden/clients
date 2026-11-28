import { css, html, nothing, unsafeCSS } from "lit";
import { customElement, property, query } from "lit/decorators.js";

import { AriaTargetHost } from "../../core/aria";
import { BitElement } from "../../core/bit-element";
import { BitwardenIcon } from "../../icon/shared-icon";
import { renderChipContent } from "../shared/chip-content";
import {
  ChipSize,
  ChipVariant,
  chipClasses,
  chipHostCss,
  testStateClasses,
} from "../shared/chip-styles";

/**
 * Action chips trigger a single contextual action related to the current view or task. They do not
 * have selection state and do not manage input. Use action chips for quick, one-off actions like
 * filtering, sorting, or navigating to related content.
 *
 * Renders a button, or a link when `href` is set (Angular `button[bit-chip-action]` /
 * `a[bit-chip-action]`). Disabled chips use `aria-disabled`, so they stay focusable while clicks
 * are blocked.
 *
 * @cssprop --bit-chip-max-width - Maximum width before the label truncates. Defaults to 13rem.
 */
@customElement("bit-chip-action")
export class BitChipAction extends BitElement implements AriaTargetHost {
  static shadowRootOptions = { ...BitElement.shadowRootOptions, delegatesFocus: true };

  static styles = [
    BitElement.styles,
    css`
      ${unsafeCSS(chipHostCss)}
    `,
  ];

  @property() label = "";

  @property({ attribute: "start-icon" }) startIcon?: BitwardenIcon;

  @property({ reflect: true }) variant: ChipVariant = "primary";

  @property({ reflect: true }) size: ChipSize = "large";

  @property({ type: Boolean, reflect: true }) disabled = false;

  /** Renders with the selected (`primary`) appearance. */
  @property({ type: Boolean }) selected = false;

  /** Stretch to the full width of the container. */
  @property({ type: Boolean, attribute: "full-width", reflect: true }) fullWidth = false;

  /** Accessible name for the button or link when the visible label isn't enough, e.g. "+3". */
  @property({ attribute: "accessible-name" }) accessibleName?: string;

  /** Renders a link instead of a button. */
  @property() href?: string;

  @property() target?: string;

  @property() rel?: string;

  @query("button, a") readonly ariaTarget!: HTMLElement | null;

  constructor() {
    super();
    // Capture so consumer `click` listeners on the host never see clicks on a disabled chip.
    this.addEventListener("click", this.onHostClick, { capture: true });
  }

  private onHostClick = (event: MouseEvent) => {
    if (this.disabled) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  };

  render() {
    const classes = [
      chipClasses({
        variant: this.variant,
        size: this.size,
        selected: this.selected,
        fullWidth: this.fullWidth,
      }),
      "tw-cursor-pointer",
      testStateClasses(this),
    ].join(" ");
    const content = renderChipContent(this.label, { size: this.size, startIcon: this.startIcon });

    if (this.href != null) {
      return html`<a
        part="base"
        class=${classes}
        href=${this.href}
        target=${this.target ?? nothing}
        rel=${this.rel ?? nothing}
        aria-label=${this.accessibleName ?? nothing}
        aria-disabled=${this.disabled ? "true" : nothing}
        >${content}</a
      >`;
    }
    return html`<button
      part="base"
      type="button"
      class=${classes}
      aria-label=${this.accessibleName ?? nothing}
      aria-disabled=${this.disabled ? "true" : nothing}
    >
      ${content}
    </button>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bit-chip-action": BitChipAction;
  }
}
