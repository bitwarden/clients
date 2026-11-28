import { css, html, nothing, PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import { BitElement } from "../../core/bit-element";
import type { BitwardenIcon } from "../../icon/shared-icon";

/**
 * A content tab inside `bit-tab-group`. The element itself is the tab panel.
 *
 * Content is lazy: the default slot is only rendered while the tab is active (or, with the
 * group's `preserve-content`, once it has been active). For content that shouldn't even be
 * created until then, put it in a `<template>` child; it's stamped on first activation and
 * removed again when the tab deactivates unless content is preserved.
 *
 * @slot - The panel content.
 */
@customElement("bit-tab")
export class BitTab extends BitElement {
  static styles = [
    BitElement.styles,
    css`
      :host {
        display: block;
      }
      :host([hidden]) {
        display: none;
      }
    `,
  ];

  private readonly internals = this.attachInternals();

  /** Text shown in the tab header. */
  @property() label = "";

  @property({ type: Boolean, reflect: true }) disabled = false;

  @property({ type: Number, attribute: "berry-value" }) berryValue?: number;

  @property({ attribute: "start-icon" }) startIcon?: BitwardenIcon;

  @property({ attribute: "end-icon" }) endIcon?: BitwardenIcon;

  /**
   * tabindex for the panel. Set to `0` when the panel has no focusable content, or its first
   * content isn't focusable, so it's reachable in the tab sequence.
   *
   * @remarks See note 4 of https://www.w3.org/WAI/ARIA/apg/patterns/tabpanel/
   */
  @property({ type: Number, attribute: "content-tab-index" }) contentTabIndex?: number;

  /** @internal Set by `bit-tab-group`. */
  @state() active = false;

  /** @internal Set by `bit-tab-group`. */
  @state() preserveContent = false;

  /** @internal The rendered tab button in the group's header. */
  tabButton: HTMLElement | null = null;

  /** Latches the first time the tab becomes active. */
  private hasBeenActive = false;
  private stamped: Node[] = [];

  /** The tab's button in the header, e.g. to anchor a popover to the tab. */
  get anchorElement(): HTMLElement | null {
    return this.tabButton;
  }

  private get renderContent() {
    return this.active || (this.preserveContent && this.hasBeenActive);
  }

  connectedCallback() {
    super.connectedCallback();
    this.internals.role = "tabpanel";
  }

  protected willUpdate(changed: PropertyValues<this>) {
    if (this.active) {
      this.hasBeenActive = true;
    }
    if (changed.has("label")) {
      this.internals.ariaLabel = this.label || null;
    }
    this.hidden = !this.active;
    if (this.contentTabIndex === undefined) {
      this.removeAttribute("tabindex");
    } else {
      this.tabIndex = this.contentTabIndex;
    }
  }

  protected updated(changed: PropertyValues<this>) {
    this.syncTemplate();
    if (
      changed.has("label") ||
      changed.has("disabled") ||
      changed.has("berryValue") ||
      changed.has("startIcon") ||
      changed.has("endIcon")
    ) {
      this.dispatchEvent(new Event("bit-tab-change", { bubbles: true, composed: true }));
    }
  }

  private syncTemplate() {
    const template = Array.from(this.children).find(
      (el): el is HTMLTemplateElement => el instanceof HTMLTemplateElement,
    );
    if (this.renderContent && template && this.stamped.length === 0) {
      const content = document.importNode(template.content, true);
      this.stamped = Array.from(content.childNodes);
      template.after(content);
    } else if (!this.renderContent && this.stamped.length) {
      this.stamped.forEach((node) => node.parentNode?.removeChild(node));
      this.stamped = [];
    }
  }

  render() {
    return this.renderContent ? html`<slot></slot>` : nothing;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bit-tab": BitTab;
  }
}
