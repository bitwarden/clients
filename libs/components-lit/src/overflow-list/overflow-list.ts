import { css, html, PropertyValues } from "lit";
import { customElement, property, query, state } from "lit/decorators.js";

import { BitElement } from "../core/bit-element";

import {
  attachOverflowList,
  OVERFLOW_PINNED_ATTRIBUTE,
  OverflowListHandle,
  OverflowListState,
} from "./attach-overflow-list";
import type { OverflowStrategy } from "./pack";

/**
 * A horizontal row of slotted items that never wraps. Items that don't fit are hidden in place
 * and reported through `overflow` and the `overflowChange` event, so the consumer can render them
 * elsewhere, typically in a menu opened by the element in the `trigger` slot.
 *
 * - Add `data-overflow-pinned` to an item to keep it visible regardless of space.
 * - The trigger is hidden when nothing overflows (unless `trigger-always-show`).
 * - When only one item is displayed it gets `data-overflow-shrink` and may truncate.
 *
 * Use `attachOverflowList()` instead when the items live in your own shadow root.
 *
 * @slot - The items.
 * @slot trigger - The "More" affordance; its width is reserved once anything overflows.
 * @csspart list - The flex row.
 * @fires overflowChange - `CustomEvent<OverflowListState>` when the packing decision changes.
 */
@customElement("bit-overflow-list")
export class BitOverflowList extends BitElement {
  static styles = [
    BitElement.styles,
    css`
      :host {
        display: block;
        min-width: 0;
      }
      ::slotted(*) {
        flex-shrink: 0;
      }
      ::slotted([data-overflow-shrink]) {
        flex: 1 1 0%;
        min-width: 0;
        overflow: hidden;
      }
    `,
  ];

  /** Horizontal gap between items, in pixels. */
  @property({ type: Number }) gap = 0;

  /** `"end"` overflows trailing items; `"middle"` keeps the first and last (breadcrumbs). */
  @property() strategy: OverflowStrategy = "end";

  /**
   * Pack against this width instead of the element's own. Use when the element is content-sized
   * in its parent, which would otherwise feed back into itself.
   */
  @property({ type: Number, attribute: "container-width" }) containerWidth: number | null = null;

  /** Keep the trigger visible when nothing overflows, e.g. its menu has other actions too. */
  @property({ type: Boolean, attribute: "trigger-always-show" }) triggerAlwaysShow = false;

  @state() private listState: OverflowListState = {
    displayed: [],
    overflow: [],
    ready: false,
    measured: false,
    triggerHidden: false,
    shrinkIndex: -1,
    hiddenElements: new Set(),
  };

  @query("[part=list]") private listEl!: HTMLElement;
  @query("slot:not([name])") private itemSlot?: HTMLSlotElement;
  @query("slot[name=trigger]") private triggerSlot?: HTMLSlotElement;

  private handle?: OverflowListHandle;
  private readonly pinObserver = new MutationObserver(() => this.handle?.update());

  /** The managed (default-slotted) items in DOM order. */
  get items(): HTMLElement[] {
    return (this.itemSlot?.assignedElements() ?? []) as HTMLElement[];
  }

  /** Indices of items in the visible row. */
  get displayed() {
    return this.listState.displayed;
  }

  /** Indices of items to surface via the overflow affordance. */
  get overflow() {
    return this.listState.overflow;
  }

  /** The overflowed item elements. */
  get overflowItems(): HTMLElement[] {
    const items = this.items;
    return this.listState.overflow.map((i) => items[i]);
  }

  get ready() {
    return this.listState.ready;
  }

  get measured() {
    return this.listState.measured;
  }

  get triggerHidden() {
    return this.listState.triggerHidden;
  }

  get hiddenElements() {
    return this.listState.hiddenElements;
  }

  /** Re-cache item widths after something changes how the same items render. */
  remeasure(options?: { reset?: boolean }) {
    this.handle?.remeasure(options);
  }

  connectedCallback() {
    super.connectedCallback();
    this.pinObserver.observe(this, {
      subtree: true,
      attributes: true,
      attributeFilter: [OVERFLOW_PINNED_ATTRIBUTE],
    });
    if (this.hasUpdated) {
      this.attach();
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.pinObserver.disconnect();
    this.handle?.destroy();
    this.handle = undefined;
  }

  protected firstUpdated() {
    this.attach();
  }

  protected updated(changed: PropertyValues<this>) {
    if (
      changed.has("gap") ||
      changed.has("strategy") ||
      changed.has("containerWidth") ||
      changed.has("triggerAlwaysShow")
    ) {
      this.handle?.update(this.options());
    }
  }

  private options() {
    return {
      gap: this.gap,
      strategy: this.strategy,
      containerWidth: this.containerWidth,
      triggerAlwaysShow: this.triggerAlwaysShow,
    };
  }

  private attach() {
    this.handle?.destroy();
    this.handle = attachOverflowList(this.listEl, {
      ...this.options(),
      items: () => this.items,
      trigger: () => (this.triggerSlot?.assignedElements()[0] as HTMLElement) ?? null,
      onChange: (next) => {
        this.listState = next;
        this.dispatchEvent(
          new CustomEvent<OverflowListState>("overflowChange", {
            detail: next,
            bubbles: true,
            composed: true,
          }),
        );
      },
    });
  }

  private onSlotChange = () => this.handle?.update();

  render() {
    return html`<div
      part="list"
      class="tw-flex tw-flex-nowrap tw-min-w-0 tw-items-center ${
        this.listState.ready ? "" : "tw-invisible"
      }"
      style="gap: ${this.gap}px"
    >
      <slot @slotchange=${this.onSlotChange}></slot>
      <slot name="trigger" @slotchange=${this.onSlotChange}></slot>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bit-overflow-list": BitOverflowList;
  }
  interface HTMLElementEventMap {
    overflowChange: CustomEvent<OverflowListState>;
  }
}
