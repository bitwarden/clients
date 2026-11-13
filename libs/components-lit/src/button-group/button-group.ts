import { css, html, PropertyValues } from "lit";
import { customElement, property, query, state } from "lit/decorators.js";

import { BitElement } from "../core/bit-element";

export type ButtonGroupOrientation = "horizontal" | "vertical" | "auto";

type Stretchable = HTMLElement & { block: boolean };

function isStretchable(el: Element): el is Stretchable {
  return "block" in el && typeof (el as { block: unknown }).block === "boolean";
}

/**
 * Lays out related buttons in a row or a stack, optionally sharing the container's width equally.
 *
 * @slot - Buttons
 */
@customElement("bit-button-group")
export class BitButtonGroup extends BitElement {
  static styles = [
    BitElement.styles,
    css`
      :host {
        display: block;
      }
      .full-width ::slotted(*) {
        min-width: 0;
      }
    `,
  ];

  /**
   * `auto` keeps the buttons in a row while they fit the group's width, and stacks them all once
   * they don't.
   */
  @property({ reflect: true }) orientation: ButtonGroupOrientation = "horizontal";

  /** Buttons in a row share the full width equally. Stacked buttons always stretch. */
  @property({ type: Boolean, reflect: true, attribute: "full-width" }) fullWidth = false;

  @state() private naturalWidths: number[] = [];
  @state() private gap = 0;
  @state() private fits = true;

  @query("[part=base]") private base!: HTMLElement;

  // Buttons we set `block` on so they fill their track; restored when no longer stretched.
  private stretched = new Set<Stretchable>();

  private resizeObserver = new ResizeObserver(() => this.measure());
  // Measured from light DOM so text and child changes are caught, not just slot changes.
  private mutationObserver = new MutationObserver(() => this.measure());

  connectedCallback() {
    super.connectedCallback();
    this.resizeObserver.observe(this);
    this.mutationObserver.observe(this, { childList: true, subtree: true, characterData: true });
    this.addEventListener("slotchange", this.onChildSlotChange);
    void (document.fonts?.ready ?? Promise.resolve()).then(() => this.measure());
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.resizeObserver.disconnect();
    this.mutationObserver.disconnect();
    this.removeEventListener("slotchange", this.onChildSlotChange);
  }

  // Fires when a forwarded `<slot>` child's assigned content changes; the mutation observer only
  // sees this element's own light DOM.
  private onChildSlotChange = () => this.measure();

  /** The width, in px, the buttons need in a single row at their natural sizes. */
  get naturalWidth() {
    return this.naturalWidths.reduce((sum, w) => sum + w, 0) + this.gaps;
  }

  private get gaps() {
    return this.gap * Math.max(0, this.naturalWidths.length - 1);
  }

  private get rowWidth() {
    if (!this.fullWidth) {
      return this.naturalWidth;
    }
    return Math.max(0, ...this.naturalWidths) * this.naturalWidths.length + this.gaps;
  }

  private get stacked() {
    switch (this.orientation) {
      case "vertical":
        return true;
      case "auto":
        return !this.fits;
      default:
        return false;
    }
  }

  /** Direct children, with a `<slot>` child (a wrapper forwarding its content) flattened. */
  private get buttons() {
    return Array.from(this.children)
      .flatMap((el) =>
        el instanceof HTMLSlotElement ? el.assignedElements({ flatten: true }) : el,
      )
      .filter(
        (el): el is HTMLElement => el instanceof HTMLElement && el.getClientRects().length > 0,
      );
  }

  private measure() {
    const buttons = this.buttons;
    const widths = buttons.map((el) => {
      const prevWidth = el.style.width;
      el.style.width = "max-content";
      const width = Math.ceil(el.getBoundingClientRect().width);
      el.style.width = prevWidth;
      return width;
    });
    if (widths.join() !== this.naturalWidths.join()) {
      this.naturalWidths = widths;
    }
    if (this.base) {
      this.gap = parseFloat(getComputedStyle(this.base).columnGap) || 0;
    }
    const width = this.clientWidth;
    this.fits = width === 0 || this.rowWidth <= width;
  }

  protected willUpdate(changed: PropertyValues<this>) {
    if (changed.has("fullWidth")) {
      const width = this.clientWidth;
      this.fits = width === 0 || this.rowWidth <= width;
    }
  }

  protected updated() {
    // `bit-button` renders its button inside its shadow root, so stretching the host in a grid
    // track or a column doesn't stretch the button. Its `block` mode does.
    const stretch = this.stacked || this.fullWidth;
    for (const el of this.buttons) {
      if (!isStretchable(el)) {
        continue;
      }
      if (stretch && !el.block) {
        el.block = true;
        this.stretched.add(el);
      } else if (!stretch && this.stretched.has(el)) {
        el.block = false;
        this.stretched.delete(el);
      }
    }
  }

  render() {
    const layout = this.stacked
      ? "tw-flex tw-flex-col tw-items-stretch"
      : this.fullWidth
        ? "tw-grid tw-grid-flow-col tw-auto-cols-fr full-width"
        : "tw-flex tw-items-center";
    return html`<div part="base" class="tw-gap-3 ${layout}"><slot></slot></div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bit-button-group": BitButtonGroup;
  }
}
