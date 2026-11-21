import { ContextConsumer } from "@lit/context";
import { css, html, nothing } from "lit";
import { customElement, property, query } from "lit/decorators.js";

import { BitElement } from "../core/bit-element";

import { AutofocusFallbackHost, dialogRefContext } from "./dialog-ref";

/**
 * Compact centered dialog for alerts and confirmations. Open it with `openDialog(…, { position:
 * "center" })`, or use `openSimpleDialog` for the standard configurable version. To submit a form,
 * wrap it: `<form><bit-simple-dialog>…</bit-simple-dialog></form>`.
 *
 * @slot title - Heading.
 * @slot - Message.
 * @slot icon - Replaces the default warning icon.
 * @slot footer - Stacked actions; give `bit-button`s the `block` attribute.
 */
@customElement("bit-simple-dialog")
export class BitSimpleDialog extends BitElement implements AutofocusFallbackHost {
  static styles = [
    BitElement.styles,
    css`
      :host {
        display: flex;
        flex-direction: column;
        min-height: 0;
        max-height: 100%;
      }
      .dialog {
        animation:
          bit-simple-dialog-fade 0.15s linear,
          bit-simple-dialog-slide 0.3s ease-out;
      }
      @keyframes bit-simple-dialog-fade {
        from {
          opacity: 0;
        }
      }
      @keyframes bit-simple-dialog-slide {
        from {
          transform: translateY(-50px);
        }
      }
    `,
  ];

  /** Hide the icon. */
  @property({ type: Boolean, attribute: "hide-icon" }) hideIcon = false;

  @query("h1") private headingEl!: HTMLElement;

  @query("slot[name=footer]") private footerSlot!: HTMLSlotElement;

  private readonly refConsumer = new ContextConsumer(this, {
    context: dialogRefContext,
    subscribe: true,
  });

  /** Focus target when nothing has `autofocus`: the first footer button, else the heading. */
  autofocusFallback() {
    for (const el of this.footerSlot?.assignedElements({ flatten: true }) ?? []) {
      const button = el.matches("bit-button, button") ? el : el.querySelector("bit-button, button");
      if (button instanceof HTMLElement) {
        return button;
      }
    }
    return this.headingEl;
  }

  private onTitleChange = (event: Event) => {
    const ref = this.refConsumer.value;
    if (ref) {
      ref.label = (event.target as HTMLSlotElement)
        .assignedNodes({ flatten: true })
        .map((node) => node.textContent?.trim())
        .filter(Boolean)
        .join(" ");
    }
  };

  render() {
    return html`<div
      part="base"
      class="dialog tw-my-4 tw-pb-6 tw-pt-8 tw-flex tw-max-h-screen tw-w-96 tw-max-w-90vw tw-flex-col tw-overflow-hidden tw-rounded-3xl tw-border tw-border-solid tw-border-secondary-100 tw-shadow-lg tw-bg-text-contrast tw-text-main"
    >
      <div class="tw-flex tw-px-6 tw-flex-col tw-items-center tw-gap-2 tw-text-center">
        ${
          this.hideIcon
            ? nothing
            : html`<slot name="icon">
                <i
                  class="bwi bwi-exclamation-triangle tw-text-3xl tw-text-warning"
                  aria-hidden="true"
                ></i>
              </slot>`
        }
        <h1
          class="tw-w-full tw-m-0 tw-text-xl tw-font-medium tw-text-main tw-break-words focus-visible:tw-outline-none"
          tabindex="-1"
        >
          <slot name="title" @slotchange=${this.onTitleChange}></slot>
        </h1>
      </div>
      <div
        class="tw-overflow-y-auto tw-px-6 tw-mb-6 tw-text-center tw-text-base tw-break-words"
        tabindex="0"
      >
        <slot></slot>
      </div>
      <div class="tw-flex tw-flex-col tw-gap-2 tw-px-6">
        <slot name="footer"></slot>
      </div>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bit-simple-dialog": BitSimpleDialog;
  }
}
