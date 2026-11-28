import { ContextConsumer, ContextProvider } from "@lit/context";
import { css, html, PropertyValues } from "lit";
import { customElement, property, query, state } from "lit/decorators.js";

import { BitElement } from "../core/bit-element";

import {
  classifyEndSlot,
  endSlotPaddingClasses,
  endSlotStyles,
  itemContext,
  itemGroupContext,
  ItemSize,
} from "./item-styles";

/** True when `path` reaches an enabled button or a link before leaving `boundary`. */
function hitsInteractive(path: EventTarget[], boundary: Element): boolean {
  for (const target of path) {
    if (target === boundary) {
      return false;
    }
    if (target instanceof HTMLButtonElement) {
      return !target.disabled;
    }
    if (target instanceof HTMLAnchorElement) {
      return true;
    }
  }
  return false;
}

/**
 * A horizontal card holding one primary `bit-item-content` and optional secondary actions.
 *
 * @slot - The primary content, usually `bit-item-content`.
 * @slot end - Secondary actions, each wrapped in `bit-item-action`. Spacing is applied per
 *   content type; don't add your own margins.
 */
@customElement("bit-item")
export class BitItem extends BitElement {
  static styles = [
    BitElement.styles,
    endSlotStyles,
    css`
      :host {
        display: block;
      }
      :host(:state(focus-visible-within)) {
        position: relative;
        z-index: 10;
      }
      @container style(--bit-compact: 1) {
        :host(:first-of-type) [part="item"] {
          border-start-start-radius: 0.5rem;
          border-start-end-radius: 0.5rem;
        }
        :host(:last-of-type) [part="item"] {
          border-end-start-radius: 0.5rem;
          border-end-end-radius: 0.5rem;
        }
        :host(:not(:first-of-type)) [part="item"] {
          border-top-width: 0;
        }
      }
    `,
  ];

  private readonly internals = this.attachInternals();

  /** Internal padding. Compact mode overrides both sizes. */
  @property({ reflect: true }) size: ItemSize = "base";

  @state() private endSlotHasChildren = false;
  @state() private endsWithIconButton = false;
  @state() private focusVisibleWithin = false;
  @state() private mainActive = false;
  @state() private mainHover = false;

  @query("slot[name=end]") private endSlot?: HTMLSlotElement;
  @query("[data-item-main-content]") private main?: HTMLElement;

  private readonly provider = new ContextProvider(this, itemContext, {
    size: this.size,
    endSlotHasChildren: false,
  });

  private readonly group = new ContextConsumer(this, itemGroupContext, () => this.syncRole(), true);

  // Wrapped end-slot content can change without a slotchange.
  private readonly endObserver = new MutationObserver(() => this.classifyEnd());

  connectedCallback() {
    super.connectedCallback();
    this.endObserver.observe(this, { childList: true, subtree: true, attributes: false });
    this.syncRole();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.endObserver.disconnect();
  }

  /** Standalone items may already be wrapped in a consumer's own list, so only claim `listitem` inside a group. */
  private syncRole() {
    this.internals.role = this.group.value ? "listitem" : null;
  }

  protected willUpdate(changed: PropertyValues) {
    if (changed.has("size") || changed.has("endSlotHasChildren")) {
      this.provider.setValue(
        { size: this.size, endSlotHasChildren: this.endSlotHasChildren },
        true,
      );
    }
    if (this.focusVisibleWithin) {
      this.internals.states.add("focus-visible-within");
    } else {
      this.internals.states.delete("focus-visible-within");
    }
  }

  private classifyEnd = () => {
    const elements = this.endSlot?.assignedElements({ flatten: true }) ?? [];
    this.endSlotHasChildren = elements.length > 0;
    this.endsWithIconButton = classifyEndSlot(elements);
  };

  /** We have `:focus-within` and `:focus-visible` but no `:focus-visible-within`. */
  private onFocusIn = (event: FocusEvent) => {
    const target = event.composedPath()[0] as Element;
    this.focusVisibleWithin = target.matches?.("[data-fvw-target]:focus-visible") ?? false;
    this.mainActive =
      !!this.main && this.focusVisibleWithin && hitsInteractive(event.composedPath(), this.main);
  };

  private onFocusOut = () => {
    this.focusVisibleWithin = false;
    this.mainActive = false;
  };

  private onPointerOver = (event: PointerEvent) => {
    if (this.main) {
      this.mainHover = hitsInteractive(event.composedPath(), this.main);
    }
  };

  private onPointerLeave = () => {
    this.mainHover = false;
  };

  render() {
    const classes = [
      "tw-flex tw-rounded-lg tw-gap-3 tw-justify-between tw-overflow-hidden tw-bg-bg-primary tw-text-fg-heading tw-border-solid tw-border-border-base tw-min-h-9",
      "tw-border bit-compact:tw-rounded-none tw-mb-1.5 bit-compact:tw-mb-0",
      ...(this.mainHover || this.mainActive ? ["!tw-bg-bg-brand-softer"] : []),
      ...(this.mainHover ? ["tw-cursor-pointer"] : []),
      ...(this.focusVisibleWithin
        ? [
            "tw-outline-none tw-ring-1 tw-border-border-focus tw-ring-border-focus bit-compact:tw-ring-inset bit-compact:tw-ring-2",
          ]
        : []),
    ].join(" ");

    return html`<div
      part="item"
      class=${classes}
      @focusin=${this.onFocusIn}
      @focusout=${this.onFocusOut}
    >
      <div
        data-item-main-content
        class="tw-flex tw-flex-1 tw-overflow-hidden"
        @pointerover=${this.onPointerOver}
        @pointerleave=${this.onPointerLeave}
      >
        <slot></slot>
      </div>
      <div
        data-bit-item-end-slot
        class="tw-flex tw-items-center ${endSlotPaddingClasses(this.size, this.endsWithIconButton)}"
        ?hidden=${!this.endSlotHasChildren}
      >
        <slot name="end" @slotchange=${this.classifyEnd}></slot>
      </div>
    </div>`;
  }
}

/**
 * Wraps each secondary action in a `bit-item`'s `end` slot.
 *
 * @slot - The action, e.g. `bit-icon-button`.
 */
@customElement("bit-item-action")
export class BitItemAction extends BitElement {
  static styles = [
    BitElement.styles,
    css`
      :host {
        display: inline-flex;
        align-items: center;
        position: relative;
      }
    `,
  ];

  render() {
    return html`<slot></slot>`;
  }
}

/**
 * Groups related `bit-item`s as a list. Give it an accessible name with `aria-label` or
 * `aria-labelledby`.
 *
 * @slot - `bit-item` elements.
 */
@customElement("bit-item-group")
export class BitItemGroup extends BitElement {
  static styles = [
    BitElement.styles,
    css`
      :host {
        display: block;
      }
    `,
  ];

  private readonly internals = this.attachInternals();

  constructor() {
    super();
    new ContextProvider(this, itemGroupContext, true);
  }

  connectedCallback() {
    super.connectedCallback();
    this.internals.role = "list";
  }

  render() {
    return html`<slot></slot>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bit-item": BitItem;
    "bit-item-action": BitItemAction;
    "bit-item-group": BitItemGroup;
  }
}
