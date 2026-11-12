import { css, html, PropertyValues } from "lit";
import { customElement, property } from "lit/decorators.js";

import { BitElement } from "../core/bit-element";

import { attachDisclosureTrigger, DisclosureTriggerHandle } from "./attach-disclosure-trigger";
import type { BitDisclosure } from "./disclosure";
import "./disclosure";

/**
 * Makes its first child element toggle the `bit-disclosure` whose id is `for`, in the same document
 * or shadow root. For Lit templates, `disclosureTriggerFor()` avoids the wrapper.
 *
 * @slot - The trigger element
 */
@customElement("bit-disclosure-trigger")
export class BitDisclosureTrigger extends BitElement {
  static styles = [
    BitElement.styles,
    css`
      :host {
        display: contents;
      }
    `,
  ];

  /** Id of the `bit-disclosure` to control. */
  @property() for = "";

  private handle?: DisclosureTriggerHandle;
  private trigger?: HTMLElement;

  disconnectedCallback() {
    super.disconnectedCallback();
    this.detach();
  }

  protected updated(changed: PropertyValues<this>) {
    if (changed.has("for")) {
      this.attach();
    }
  }

  private get disclosure() {
    const root = this.getRootNode() as Document | ShadowRoot;
    const el = root.getElementById?.(this.for);
    return el?.localName === "bit-disclosure" ? (el as BitDisclosure) : undefined;
  }

  private detach() {
    this.handle?.destroy();
    this.handle = undefined;
  }

  private attach() {
    const disclosure = this.disclosure;
    if (!this.trigger || !disclosure) {
      this.detach();
      return;
    }
    if (this.handle) {
      this.handle.update(disclosure);
    } else {
      this.handle = attachDisclosureTrigger(this.trigger, disclosure);
    }
  }

  private onSlotChange = (event: Event) => {
    const [first] = (event.target as HTMLSlotElement).assignedElements();
    if (first === this.trigger) {
      return;
    }
    this.detach();
    this.trigger = first instanceof HTMLElement ? first : undefined;
    this.attach();
  };

  render() {
    return html`<slot @slotchange=${this.onSlotChange}></slot>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bit-disclosure-trigger": BitDisclosureTrigger;
  }
}
