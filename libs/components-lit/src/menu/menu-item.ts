import { css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import { AriaTargetHost } from "../core/aria";
import { BitElement } from "../core/bit-element";

import {
  MENU_CLOSE_ATTRIBUTE,
  menuItemBaseStyles,
  menuItemDangerStyles,
  menuItemPrimaryStyles,
} from "./menu-styles";

const variantStyles = {
  primary: menuItemPrimaryStyles,
  danger: menuItemDangerStyles,
};

/**
 * Item in a `bit-menu`. Renders a button, or a link when `href` is set. Clicking it closes the menu.
 *
 * @slot - Label.
 * @slot start - Leading icon or `bit-icon-tile` (use `size="xs"`).
 * @slot end - Trailing icon or hint.
 */
@customElement("bit-menu-item")
export class BitMenuItem extends BitElement implements AriaTargetHost {
  static shadowRootOptions = { ...BitElement.shadowRootOptions, delegatesFocus: true };

  static styles = [
    BitElement.styles,
    css`
      :host {
        display: block;
      }
      /* An inline icon-tile host gains descender space; force a flex box so it stays centered. */
      ::slotted(bit-icon-tile) {
        display: flex;
      }
    `,
  ];

  @property({ reflect: true }) variant: "primary" | "danger" = "primary";

  /** Disabled items are skipped by keyboard navigation and ignore clicks. */
  @property({ type: Boolean, reflect: true }) disabled = false;

  @property() href?: string;

  @property() target?: string;

  @property() rel?: string;

  @property() download?: string;

  /** With `href`: marks the link as the current page (`aria-current="page"`). */
  @property({ type: Boolean }) current = false;

  @state() private hasEnd = false;

  get ariaTarget(): HTMLElement | null {
    return this.renderRoot.querySelector<HTMLElement>("[role=menuitem]");
  }

  constructor() {
    super();
    this.addEventListener("click", this.onHostClick, { capture: true });
  }

  connectedCallback() {
    super.connectedCallback();
    if (!this.hasAttribute(MENU_CLOSE_ATTRIBUTE)) {
      this.setAttribute(MENU_CLOSE_ATTRIBUTE, "");
    }
  }

  private onHostClick = (event: MouseEvent) => {
    if (this.disabled) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  };

  render() {
    const classes = ["tw-block", ...menuItemBaseStyles, ...variantStyles[this.variant]].join(" ");
    const content = html`<div class="tw-flex tw-w-full tw-justify-between tw-items-center tw-gap-2">
      <span class="tw-flex tw-gap-2 tw-items-center tw-overflow-hidden tw-text-sm tw-font-medium">
        <slot name="start"></slot>
        <span class="tw-truncate"><slot></slot></span>
      </span>
      <span
        class="tw-flex tw-items-center tw-gap-2 tw-text-fg-body-subtle tw-text-xs"
        ?hidden=${!this.hasEnd}
      >
        <slot
          name="end"
          @slotchange=${(e: Event) =>
            (this.hasEnd = (e.target as HTMLSlotElement).assignedNodes().length > 0)}
        ></slot>
      </span>
    </div>`;

    if (this.href) {
      return html`<a
        part="base"
        class=${classes}
        role="menuitem"
        tabindex="-1"
        href=${this.disabled ? nothing : this.href}
        target=${this.target ?? nothing}
        rel=${this.rel ?? nothing}
        download=${this.download ?? nothing}
        aria-disabled=${this.disabled ? "true" : nothing}
        aria-current=${this.current ? "page" : nothing}
        >${content}</a
      >`;
    }
    return html`<button
      part="base"
      type="button"
      class=${classes}
      role="menuitem"
      tabindex="-1"
      ?disabled=${this.disabled}
    >
      ${content}
    </button>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bit-menu-item": BitMenuItem;
  }
}
