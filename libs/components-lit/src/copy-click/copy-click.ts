import { css, html, PropertyValues } from "lit";
import { customElement, property } from "lit/decorators.js";

import { BitElement } from "../core/bit-element";

import { attachCopyClick, CopyClickHandle, CopyClickToastVariant } from "./attach-copy-click";

const showToastConverter = {
  fromAttribute: (value: string | null): boolean | CopyClickToastVariant =>
    value === null ? false : value === "" ? true : (value as CopyClickToastVariant),
};

/**
 * Copies `value` to the clipboard when its first child is clicked. For Lit templates, the
 * `copyClick()` directive avoids the wrapper.
 *
 * @slot - The clickable element.
 * @fires copied - After copying. `detail: { value }`.
 */
@customElement("bit-copy-click")
export class BitCopyClick extends BitElement {
  static styles = [
    BitElement.styles,
    css`
      :host {
        display: contents;
      }
    `,
  ];

  @property() value = "";

  /** When set, the toast reads "<valueLabel> copied". */
  @property({ attribute: "value-label" }) valueLabel?: string;

  /** Show a toast after copying. As an attribute: present for success, or a toast variant. */
  @property({ attribute: "show-toast", converter: showToastConverter }) showToast:
    boolean | CopyClickToastVariant = false;

  private handle?: CopyClickHandle;
  private trigger?: HTMLElement;

  disconnectedCallback() {
    super.disconnectedCallback();
    this.detach();
  }

  protected updated(_changed: PropertyValues<this>) {
    this.handle?.update(this.options);
  }

  private get options() {
    return { value: this.value, valueLabel: this.valueLabel, showToast: this.showToast };
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
      this.handle = attachCopyClick(first, this.options);
    }
  };

  render() {
    return html`<slot @slotchange=${this.onSlotChange}></slot>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bit-copy-click": BitCopyClick;
  }
}
