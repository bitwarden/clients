import { ContextProvider } from "@lit/context";
import { css, html, PropertyValues } from "lit";
import { customElement, property } from "lit/decorators.js";

import { BitElement } from "../core/bit-element";

import type { AccordionVariant, BitAccordion } from "./accordion";
import { accordionGroupContext, AccordionGroupContext } from "./accordion-context";

/**
 * Stacks `bit-accordion`s into one visual group, collapsing the shared borders and inner radii.
 *
 * @slot - `bit-accordion` elements
 */
@customElement("bit-accordion-group")
export class BitAccordionGroup extends BitElement {
  static styles = [
    BitElement.styles,
    css`
      :host {
        display: block;
      }
    `,
  ];

  /** Only one accordion may be open at a time; opening one closes the others. */
  @property({ type: Boolean, attribute: "single-select" }) singleSelect = false;

  /** Variant for every accordion in the group, overriding their own. */
  @property({ reflect: true }) variant: AccordionVariant = "default";

  private readonly provider = new ContextProvider(this, accordionGroupContext, this.contextValue());

  private contextValue(): AccordionGroupContext {
    return { variant: this.variant, notifyOpened: (accordion) => this.notifyOpened(accordion) };
  }

  protected willUpdate(changed: PropertyValues<this>) {
    if (changed.has("variant")) {
      this.provider.setValue(this.contextValue(), true);
    }
  }

  private notifyOpened(opened: HTMLElement) {
    if (!this.singleSelect) {
      return;
    }
    this.querySelectorAll<BitAccordion>("bit-accordion").forEach((accordion) => {
      if (
        accordion !== opened &&
        accordion.open &&
        accordion.closest("bit-accordion-group") === this
      ) {
        accordion.setOpen(false);
      }
    });
  }

  render() {
    return html`<slot></slot>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bit-accordion-group": BitAccordionGroup;
  }
}
