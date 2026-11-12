import { css, html, PropertyValues } from "lit";
import { customElement, property } from "lit/decorators.js";

import { BitElement } from "../core/bit-element";

import { attachTooltip, TooltipHandle, TooltipPosition } from "./attach-tooltip";

/**
 * Adds a tooltip to its first child element. For Lit templates, the `tooltip()` directive avoids
 * the wrapper.
 *
 * @slot - The trigger element.
 */
@customElement("bit-tooltip")
export class BitTooltip extends BitElement {
  static styles = [
    BitElement.styles,
    css`
      :host {
        display: contents;
      }
    `,
  ];

  /** Tooltip text. */
  @property() content = "";

  @property() position: TooltipPosition = "above-center";

  /** Add the tooltip to the trigger's `aria-describedby`. */
  @property({ type: Boolean, attribute: "described-by" }) describedBy = false;

  /** Hide the tooltip and keep it from opening. */
  @property({ type: Boolean }) suppressed = false;

  private handle?: TooltipHandle;
  private trigger?: HTMLElement;

  disconnectedCallback() {
    super.disconnectedCallback();
    this.detach();
  }

  protected updated(changed: PropertyValues<this>) {
    this.handle?.update(this.options);
    if (changed.has("suppressed")) {
      this.handle?.setSuppressed(this.suppressed);
    }
  }

  private get options() {
    return { content: this.content, position: this.position, describedBy: this.describedBy };
  }

  private detach() {
    this.handle?.destroy();
    this.handle = undefined;
    this.trigger = undefined;
  }

  private onSlotChange = (event: Event) => {
    const [first] = (event.target as HTMLSlotElement).assignedElements();
    if (first === this.trigger) {
      return;
    }
    this.detach();
    if (first instanceof HTMLElement) {
      this.trigger = first;
      this.handle = attachTooltip(first, this.options);
      this.handle.setSuppressed(this.suppressed);
    }
  };

  render() {
    return html`<slot @slotchange=${this.onSlotChange}></slot>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bit-tooltip": BitTooltip;
  }
}
