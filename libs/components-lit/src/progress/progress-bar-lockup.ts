import { css, html } from "lit";
import { customElement } from "lit/decorators.js";

import { BitElement } from "../core/bit-element";

import "./progress-bar";

/**
 * The progress bar lockup component consumes the progress bar component with illustration, title, and description.
 *
 * @slot illustration - Optional decorative illustration
 * @slot title - Heading
 * @slot description - Body text
 * @slot - A `bit-progress-bar` (required)
 */
@customElement("bit-progress-bar-lockup")
export class BitProgressBarLockup extends BitElement {
  static styles = [
    BitElement.styles,
    css`
      :host {
        display: block;
      }
    `,
  ];

  private onSlotChange = (event: Event) => {
    const elements = (event.target as HTMLSlotElement).assignedElements();
    if (!elements.some((el) => el.localName === "bit-progress-bar")) {
      // eslint-disable-next-line no-console -- mirrors Angular's required contentChild error
      console.error("bit-progress-bar-lockup requires a <bit-progress-bar> child.");
    }
  };

  render() {
    return html`<div class="tw-flex tw-w-full tw-gap-8">
      <div class="tw-flex tw-justify-center tw-items-center">
        <slot name="illustration"></slot>
      </div>
      <div class="tw-flex tw-flex-col tw-justify-center tw-flex-1 tw-gap-6">
        <div class="tw-flex tw-flex-col tw-gap-1">
          <div class="!tw-text-2xl tw-text-main tw-font-medium"><slot name="title"></slot></div>
          <div class="!tw-text-base"><slot name="description"></slot></div>
        </div>
        <slot @slotchange=${this.onSlotChange}></slot>
      </div>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bit-progress-bar-lockup": BitProgressBarLockup;
  }
}
