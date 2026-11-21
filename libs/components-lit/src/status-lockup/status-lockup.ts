import { css, html } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import { BitElement } from "../core/bit-element";

export type StatusLockupSize = "base" | "small";

const MD_BREAKPOINT_PX = 768;

/** The flat-tree parent: the slot an element is assigned to, its parent, or its shadow host. */
function flatParent(el: Element): Element | null {
  return el.assignedSlot ?? el.parentElement ?? ((el.getRootNode() as ShadowRoot).host || null);
}

function hasContent(slot: HTMLSlotElement) {
  return slot
    .assignedNodes({ flatten: true })
    .some((node) => node.nodeType === Node.ELEMENT_NODE || node.textContent?.trim());
}

/**
 * The status lockup component is a centered lockup used to communicate a state or error to the user
 * through a combination of illustration, heading, body text, and an optional call-to-action button.
 *
 * @slot graphic - Optional illustration or icon tile. `bit-svg` children are sized to 80px.
 * @slot title - Heading, rendered in an `h3`
 * @slot description - Supporting body copy
 * @slot button - Optional actions
 */
@customElement("bit-status-lockup")
export class BitStatusLockup extends BitElement {
  static styles = [
    BitElement.styles,
    css`
      :host {
        display: block;
      }
      .graphic ::slotted(bit-svg) {
        width: 5rem;
        height: 5rem;
      }
      .buttons ::slotted(:not(:first-child)) {
        margin-inline-start: 0.5rem;
      }
    `,
  ];

  /**
   * Layout size. `base` scales itself down to `small` whenever the containing element is narrower
   * than the `md` breakpoint; `small` stays small at every width.
   */
  @property({ reflect: true }) size: StatusLockupSize = "base";

  @state() private containerNarrow = false;
  @state() private filled: Record<string, boolean> = {};

  private observer?: ResizeObserver;

  connectedCallback() {
    super.connectedCallback();
    // Measured off the parent with a ResizeObserver rather than a CSS container query: a container
    // query can only measure `bit-status-lockup`'s own box, and consumers routinely make that box a
    // flex item, which shrink-to-fits its content instead of filling the space available to it.
    const container = this.measurableContainer();
    if (!container) {
      return;
    }
    // Measured with `getBoundingClientRect()` because `clientWidth` reports `0` for the inline
    // parents some consumers render into.
    const update = () =>
      (this.containerNarrow = container.getBoundingClientRect().width < MD_BREAKPOINT_PX);
    update();
    this.observer = new ResizeObserver(update);
    this.observer.observe(container);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.observer?.disconnect();
    this.observer = undefined;
  }

  /**
   * The nearest ancestor whose width reflects the space available to the layout. Walks past
   * `display: contents` ancestors (including slots), which generate no box of their own and so
   * always measure `0`.
   */
  private measurableContainer(): Element | null {
    let container = flatParent(this);
    while (container && getComputedStyle(container).display === "contents") {
      container = flatParent(container);
    }
    return container;
  }

  private onSlotChange = (event: Event) => {
    const slot = event.target as HTMLSlotElement;
    this.filled = { ...this.filled, [slot.name]: hasContent(slot) };
  };

  render() {
    const small = this.size === "small" || this.containerNarrow;
    return html`<div
      class="tw-mx-auto tw-flex tw-flex-col tw-items-center tw-justify-center tw-p-6"
    >
      <div
        class="tw-flex tw-flex-col tw-gap-6 tw-items-center tw-w-full ${
          small ? "tw-max-w-[480px]" : "tw-max-w-[600px]"
        }"
      >
        <div
          class="graphic tw-flex tw-items-center tw-justify-center"
          ?hidden=${!this.filled.graphic}
        >
          <slot name="graphic" @slotchange=${this.onSlotChange}></slot>
        </div>
        <div class="tw-flex tw-flex-col tw-gap-2 tw-w-full">
          <h3
            part="title"
            class="tw-font-medium tw-text-center !tw-mb-0 tw-text-fg-heading tw-break-words ${
              small ? "tw-text-sm" : "tw-text-base"
            }"
          >
            <slot name="title"></slot>
          </h3>
          <div
            class="!tw-text-sm tw-text-center tw-text-fg-body tw-break-words"
            ?hidden=${!this.filled.description}
          >
            <slot name="description" @slotchange=${this.onSlotChange}></slot>
          </div>
        </div>
        <div class="buttons" ?hidden=${!this.filled.button}>
          <slot name="button" @slotchange=${this.onSlotChange}></slot>
        </div>
      </div>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bit-status-lockup": BitStatusLockup;
  }
}
