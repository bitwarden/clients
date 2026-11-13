import { css, html, nothing, PropertyValues } from "lit";
import { customElement, property, query, state } from "lit/decorators.js";

import type { AriaTargetHost } from "../../core/aria";
import { BitElement } from "../../core/bit-element";
import type { BitwardenIcon } from "../../icon/shared-icon";
import { renderTabLabel } from "../shared/tab-label";
import { tabListItemClasses } from "../shared/tab-styles";

/**
 * A navigation tab inside `bit-tab-nav-bar`. Angular's router `route` becomes `href` plus an
 * explicit `active`; set `active` on the link matching the current page.
 *
 * @slot - The link text (used when `label` isn't set).
 * @slot end - Extra content after the label, e.g. a count.
 */
@customElement("bit-tab-link")
export class BitTabLink extends BitElement implements AriaTargetHost {
  static styles = [
    BitElement.styles,
    css`
      :host {
        display: block;
        max-width: fit-content;
        flex-shrink: 0;
      }
      :host([data-overflow-shrink]) {
        flex: 1 1 0%;
        min-width: 0;
        overflow: hidden;
      }
    `,
  ];

  @property() href?: string;

  @property() target?: string;

  @property() rel?: string;

  /** Marks the link as the current page (`aria-current="page"`) and keeps it visible on overflow. */
  @property({ type: Boolean, reflect: true }) active = false;

  /** Label text. When unset, the slotted text is used (and shown in the overflow menu). */
  @property() label?: string;

  @property({ type: Number, attribute: "berry-value" }) berryValue?: number;

  @property({ attribute: "start-icon" }) startIcon?: BitwardenIcon;

  @property({ attribute: "end-icon" }) endIcon?: BitwardenIcon;

  @property({ type: Boolean, reflect: true }) disabled = false;

  /** @internal Roving tabindex, set by `bit-tab-nav-bar`. */
  @state() rovingTabIndex = -1;

  @query("a") private anchor!: HTMLAnchorElement;

  get ariaTarget() {
    return this.anchor ?? null;
  }

  /** Text shown for this link in the overflow menu. */
  get displayText(): string {
    return this.label ?? this.textContent?.trim() ?? "";
  }

  focus(options?: FocusOptions) {
    this.anchor?.focus(options);
  }

  /** Activates the inner link, e.g. from the overflow menu. */
  click() {
    this.anchor?.click();
  }

  protected updated(changed: PropertyValues<this>) {
    if (
      changed.has("active") ||
      changed.has("disabled") ||
      changed.has("label") ||
      changed.has("berryValue") ||
      changed.has("startIcon") ||
      changed.has("endIcon") ||
      changed.has("href")
    ) {
      this.dispatchEvent(new Event("bit-tab-link-change", { bubbles: true, composed: true }));
    }
  }

  private onClick = (event: MouseEvent) => {
    if (this.disabled) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  };

  private onKeydown = (event: KeyboardEvent) => {
    if (event.code === "Space") {
      event.preventDefault();
      this.anchor.click();
    }
  };

  render() {
    return html`<a
      role="link"
      class=${tabListItemClasses({ active: this.active, disabled: this.disabled })}
      href=${this.disabled || this.href === undefined ? nothing : this.href}
      target=${this.target ?? nothing}
      rel=${this.rel ?? nothing}
      aria-disabled=${this.disabled ? "true" : nothing}
      aria-current=${this.active ? "page" : nothing}
      tabindex=${this.rovingTabIndex}
      @click=${this.onClick}
      @keydown=${this.onKeydown}
    >
      ${renderTabLabel(
        this,
        this.label !== undefined ? html`${this.label}` : html`<slot></slot>`,
        html`<slot name="end"></slot>`,
      )}
    </a>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bit-tab-link": BitTabLink;
  }
}
