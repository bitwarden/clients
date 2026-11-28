import { ContextConsumer } from "@lit/context";
import { css, html, LitElement, nothing } from "lit";
import { customElement, property, query, state } from "lit/decorators.js";

import type { AriaTargetHost } from "../core/aria";
import { BitElement } from "../core/bit-element";

import {
  classifyEndSlot,
  endSlotPaddingClasses,
  endSlotStyles,
  ITEM_PADDING,
  itemContext,
} from "./item-styles";

/**
 * The primary content of a `bit-item`. Renders a link when `href` is set, a button when `button`
 * is set, and a static container otherwise.
 *
 * @slot - Primary text or arbitrary content.
 * @slot start - Commonly an icon or avatar, before the default slot.
 * @slot default-trailing - Content right after the default slot that shouldn't truncate, e.g. a badge.
 * @slot secondary - Supporting text under the default slot.
 * @slot end - Non-interactive content at the far end, e.g. an icon. Interactive actions belong
 *   in the `bit-item` end slot instead.
 */
@customElement("bit-item-content")
export class BitItemContent extends BitElement implements AriaTargetHost {
  static shadowRootOptions = { ...LitElement.shadowRootOptions, delegatesFocus: true };

  static styles = [
    BitElement.styles,
    endSlotStyles,
    css`
      :host {
        display: block;
        width: 100%;
        min-width: 0;
      }
      ::slotted(p) {
        margin-bottom: 0;
      }
      /* Only icons are dimmed when disabled, which reaches icon buttons. An icon tile keeps its
         own variant colors so the tile does not read as half-disabled. */
      :host([disabled]) ::slotted(i) {
        color: var(--color-fg-inactive) !important;
      }
    `,
  ];

  /** Renders the content as a link. */
  @property() href?: string;

  @property() target?: string;

  @property() rel?: string;

  /** Renders the content as a button. Listen for `click` on this element. */
  @property({ type: Boolean, reflect: true }) button = false;

  @property({ type: Boolean, reflect: true }) disabled = false;

  /** Wrap long text instead of truncating it. */
  @property({ type: Boolean, attribute: "no-truncate" }) noTruncate = false;

  @state() private endSlotHasChildren = false;
  @state() private endsWithIconButton = false;

  @query("[data-fvw-target]") private interactive?: HTMLElement;

  private readonly item = new ContextConsumer(this, { context: itemContext, subscribe: true });

  get ariaTarget() {
    return this.interactive ?? null;
  }

  private onEndSlotChange = (event: Event) => {
    const elements = (event.target as HTMLSlotElement).assignedElements({ flatten: true });
    this.endSlotHasChildren = elements.length > 0;
    this.endsWithIconButton = classifyEndSlot(elements);
  };

  private renderContent() {
    const size = this.item.value?.size ?? "base";
    const itemEndSlotHasChildren = this.item.value?.endSlotHasChildren ?? false;
    const padding = ITEM_PADDING[size];
    const wrap = this.noTruncate ? "tw-text-wrap tw-min-w-0 tw-break-words" : "tw-truncate";
    const inactive = this.disabled ? "!tw-text-fg-inactive" : "";

    // Trailing edge padding is owned by the right-most non-empty slot: the content end slot owns it
    // only when the parent `bit-item`'s end slot is empty; otherwise that slot owns it.
    const endSlotPadding = itemEndSlotHasChildren
      ? ""
      : endSlotPaddingClasses(size, this.endsWithIconButton);
    const mainPadding =
      this.endSlotHasChildren || itemEndSlotHasChildren
        ? ""
        : `${padding.trailing} bit-compact:!tw-pe-2`;

    return html`<div class="tw-flex tw-gap-3 tw-items-center tw-w-full tw-min-w-0">
        <slot name="start"></slot>
        <div
          class="tw-flex tw-flex-col tw-items-start tw-text-start tw-w-full tw-truncate ${mainPadding}"
        >
          <div
            class="!tw-text-sm tw-text-main tw-truncate tw-inline-flex tw-items-center tw-gap-1.5 tw-w-full ${inactive}"
          >
            <div class=${wrap}><slot></slot></div>
            <div class="tw-flex-grow"><slot name="default-trailing"></slot></div>
          </div>
          <div class="!tw-text-xs tw-text-muted tw-w-full ${wrap} ${inactive}">
            <slot name="secondary"></slot>
          </div>
        </div>
      </div>
      <div
        data-bit-item-end-slot
        class="tw-flex tw-items-center ${endSlotPadding}"
        ?hidden=${!this.endSlotHasChildren}
      >
        <slot name="end" @slotchange=${this.onEndSlotChange}></slot>
      </div>`;
  }

  render() {
    const size = this.item.value?.size ?? "base";
    const padding = ITEM_PADDING[size];
    // Compact mode is `!important` so it always wins over the size-derived padding.
    const classes = [
      "tw-outline-none tw-text-main hover:tw-text-main tw-no-underline hover:tw-no-underline tw-text-base bit-compact:!tw-ps-2 bit-compact:!tw-py-1.5 tw-bg-transparent tw-w-full tw-h-full tw-border-none tw-flex tw-gap-4 tw-items-center tw-justify-between tw-text-start tw-m-0",
      "disabled:tw-cursor-not-allowed aria-disabled:tw-cursor-not-allowed",
      padding.leading,
      padding.vertical,
    ].join(" ");

    if (this.href !== undefined) {
      return html`<a
        data-fvw-target
        class=${classes}
        href=${this.disabled ? nothing : this.href}
        target=${this.target ?? nothing}
        rel=${this.rel ?? nothing}
        aria-disabled=${this.disabled ? "true" : nothing}
        >${this.renderContent()}</a
      >`;
    }
    if (this.button) {
      return html`<button data-fvw-target type="button" class=${classes} ?disabled=${this.disabled}>
        ${this.renderContent()}
      </button>`;
    }
    return html`<div class=${classes}>${this.renderContent()}</div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bit-item-content": BitItemContent;
  }
}
