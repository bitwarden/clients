import { css, html } from "lit";
import { customElement, property } from "lit/decorators.js";

import { BitElement } from "../core/bit-element";

/**
 * Floating tooltip bubble rendered by `attachTooltip`. Lives in the trigger's root so
 * `aria-describedby` can reference it.
 *
 * @internal
 */
@customElement("bit-tooltip-panel")
export class BitTooltipPanel extends BitElement {
  static styles = [
    BitElement.styles,
    css`
      :host {
        --tooltip-shadow: rgba(var(--color-gray-800-rgb), 0.1);
        position: fixed;
        inset: auto;
        margin: 0;
        padding: 0;
        border: 0;
        background: transparent;
        overflow: visible;
        pointer-events: none;
      }
      .container {
        position: relative;
        max-width: 12.25rem;
        width: max-content;
        opacity: 0;
        transform: scale(0.95);
        border-radius: 0.75rem;
        box-shadow:
          0 4px 6px -1px var(--tooltip-shadow),
          0 2px 4px -2px var(--tooltip-shadow);
        transition:
          transform 100ms ease-in-out,
          opacity 100ms ease-in-out;
      }
      :host([visible]) .container {
        opacity: 1;
        transform: scale(1);
      }
      .container::before {
        content: "";
        position: absolute;
        width: 1rem;
        height: 1rem;
        rotate: 45deg;
        border-radius: 3px;
        background: var(--color-bg-contrast);
      }
      :host([data-placement^="top"]) .container::before {
        inset-inline-start: 50%;
        inset-block-end: -0.25rem;
        translate: -50% 0;
      }
      :host([data-placement^="bottom"]) .container::before {
        inset-inline-start: 50%;
        inset-block-start: -0.25rem;
        translate: -50% 0;
      }
      :host([data-placement^="start"]) .container::before {
        inset-block-start: 50%;
        inset-inline-end: -0.25rem;
        translate: 0 -50%;
      }
      :host([data-placement^="end"]) .container::before {
        inset-block-start: 50%;
        inset-inline-start: -0.25rem;
        translate: 0 -50%;
      }
      .bubble {
        position: relative;
        color: var(--color-fg-contrast);
        background-color: var(--color-bg-contrast);
        width: max-content;
        max-width: 13rem;
        padding: 0.5rem 0.75rem;
        border-radius: 0.75rem;
        font-size: 0.875rem;
        line-height: 1.25rem;
        word-break: break-word;
      }
    `,
  ];

  @property() content = "";

  @property({ type: Boolean, reflect: true }) visible = false;

  connectedCallback() {
    super.connectedCallback();
    this.setAttribute("popover", "manual");
    this.setAttribute("role", "tooltip");
  }

  render() {
    return html`<div class="container"><div class="bubble">${this.content}</div></div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bit-tooltip-panel": BitTooltipPanel;
  }
}
