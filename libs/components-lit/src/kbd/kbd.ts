import { css, html, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";

import { BitElement } from "../core/bit-element";

import { getModifierGlyph, onModifierKeyChange } from "./modifier-key";

/**
 * Renders a keyboard shortcut as one `<kbd>` per key, joined by `+`. The literal key `"modifier"`
 * renders the platform's primary modifier (`⌘` on macOS, `Ctrl` elsewhere).
 *
 * Presentational: hide it from assistive technology and set `aria-keyshortcuts` on the control.
 */
@customElement("bit-kbd")
export class BitKbd extends BitElement {
  static styles = [
    BitElement.styles,
    css`
      :host {
        display: inline-flex;
        align-items: center;
        gap: 0.25rem;
      }
    `,
  ];

  /** Keys in press order, rendered verbatim (`"F"`, `"Esc"`), or `"modifier"`. */
  @property({ type: Array }) keys: string[] = [];

  private unsubscribe?: () => void;

  connectedCallback() {
    super.connectedCallback();
    this.unsubscribe = onModifierKeyChange(() => this.requestUpdate());
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.unsubscribe?.();
  }

  render() {
    return this.keys.map(
      (key, i) =>
        html`${
            i > 0
              ? html`<span class="tw-text-xs tw-leading-none tw-text-fg-body-subtle">+</span>`
              : nothing
          }<kbd
            class="tw-inline-flex tw-items-center tw-rounded tw-border tw-border-solid tw-border-border-base tw-bg-bg-primary tw-p-1 tw-font-mono tw-text-xs/4 tw-text-fg-body-subtle"
            >${key === "modifier" ? getModifierGlyph() : key}</kbd
          >`,
    );
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bit-kbd": BitKbd;
  }
}
