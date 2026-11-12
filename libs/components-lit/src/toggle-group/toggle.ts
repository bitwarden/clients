import { css, html, LitElement, PropertyValues } from "lit";
import { customElement, property, query } from "lit/decorators.js";

import type { BitBerry } from "../berry/berry";
import { BitElement } from "../core/bit-element";
import { uniqueId } from "../core/ids";

const inputClasses = "tw-peer/toggle-input tw-appearance-none tw-outline-none tw-absolute tw-m-0";

const labelClasses = [
  "tw-py-1.5",
  "tw-px-3",
  "tw-relative",
  "tw-h-full",
  "tw-w-full",
  "tw-flex",
  "tw-items-center",
  "tw-justify-center",
  "tw-gap-1.5",
  "!tw-font-medium",
  "tw-leading-5",
  "tw-text-center",
  "tw-text-sm",
  "tw-rounded-xl",
  "tw-z-[2]",
  "tw-transition",
  "tw-duration-[350ms]",
  "!tw-text-fg-body",
  "tw-cursor-pointer",

  "hover:tw-bg-bg-hover",

  "after:tw-content-['']",
  "after:tw-w-px",
  "after:tw-h-[calc(100%_-_theme(spacing.2))]",
  "after:tw-absolute",
  "after:tw-right-[-2px]",
  "after:tw-top-[50%]",
  "after:tw-translate-x-[100%]",
  "after:tw-translate-y-[-50%]",
  "after:tw-bg-border-base",
  "after:tw-transition-opacity",

  "peer-focus-visible/toggle-input:tw-outline-none",
  "peer-focus-visible/toggle-input:tw-ring",
  "peer-focus-visible/toggle-input:tw-ring-offset-1",
  "peer-focus-visible/toggle-input:tw-ring-border-focus",
  "peer-focus-visible/toggle-input:tw-z-10",
  "peer-focus-visible/toggle-input:tw-bg-bg-hover",

  "peer-checked/toggle-input:!tw-text-fg-contrast",
  "peer-checked/toggle-input:after:tw-opacity-[0]",

  "peer-disabled/toggle-input:tw-cursor-default",
  "peer-disabled/toggle-input:!tw-text-fg-inactive",
].join(" ");

/**
 * One option of a `bit-toggle-group`. A `bit-berry` child is shown after the label and switches
 * to the `contrast` variant while the toggle is selected.
 *
 * @slot - The label.
 */
@customElement("bit-toggle")
export class BitToggle extends BitElement {
  // Manual assignment routes `bit-berry` children to their own slot, like Angular's
  // `<ng-content select="bit-berry">`, without asking consumers for a `slot` attribute.
  static shadowRootOptions: ShadowRootInit = {
    ...LitElement.shadowRootOptions,
    delegatesFocus: true,
    slotAssignment: "manual",
  };

  static styles = [
    BitElement.styles,
    css`
      :host {
        display: flex;
        min-width: 4rem;
        position: relative;
      }
    `,
  ];

  /** The value the group's `selected` takes when this toggle is chosen. */
  @property() value: unknown;

  /** @internal Set by `bit-toggle-group`. */
  @property({ attribute: false }) checked = false;

  /** @internal Set by `bit-toggle-group`. */
  @property({ attribute: false }) tabbable = false;

  /** @internal Set by `bit-toggle-group`. */
  @property({ attribute: false }) disabled = false;

  /** @internal Set by `bit-toggle-group`: hide the divider after this toggle. */
  @property({ attribute: false }) hideDivider = false;

  @query("input") private input?: HTMLInputElement;
  @query("slot:not([name])") private labelSlot?: HTMLSlotElement;
  @query("slot[name=berry]") private berrySlot?: HTMLSlotElement;

  private readonly inputId = uniqueId("bit-toggle");
  private readonly childObserver = new MutationObserver(() => this.assignSlots());

  /** Label text without the berry, e.g. for the dropdown fallback. */
  get labelText(): string {
    return Array.from(this.childNodes)
      .filter((node) => !(node instanceof Element && node.localName === "bit-berry"))
      .map((node) => node.textContent ?? "")
      .join("")
      .trim();
  }

  get berry(): BitBerry | null {
    return this.querySelector(":scope > bit-berry");
  }

  connectedCallback() {
    super.connectedCallback();
    this.childObserver.observe(this, { childList: true, characterData: true, subtree: true });
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.childObserver.disconnect();
  }

  protected firstUpdated() {
    this.assignSlots();
  }

  protected updated(changed: PropertyValues<this>) {
    if (changed.has("checked")) {
      this.syncBerry();
    }
    if (this.input) {
      // `.checked` must be set as a property; the attribute only sets the default.
      this.input.checked = this.checked;
    }
  }

  private assignSlots() {
    const berries = Array.from(this.children).filter((el) => el.localName === "bit-berry");
    // `assign()` rejects comment nodes, such as Lit's template markers.
    const rest = Array.from(this.childNodes).filter(
      (node): node is Element | Text =>
        (node instanceof Element || node instanceof Text) && !berries.includes(node as Element),
    );
    this.labelSlot?.assign(...rest);
    this.berrySlot?.assign(...berries);
    this.syncBerry();
    this.requestUpdate();
    this.dispatchEvent(new Event("bit-toggle-change", { bubbles: true, composed: true }));
  }

  private syncBerry() {
    const berry = this.berry;
    if (berry) {
      berry.variant = this.checked ? "contrast" : "primary";
    }
  }

  private onChange = () => {
    this.dispatchEvent(new Event("bit-toggle-select", { bubbles: true, composed: true }));
  };

  render() {
    const hasBerry = !!this.berry;
    const dividerHidden = this.hideDivider ? "after:!tw-opacity-0" : "";
    return html`
      <input
        type="radio"
        id=${this.inputId}
        class=${inputClasses}
        aria-label=${this.labelText}
        tabindex=${this.tabbable ? 0 : -1}
        ?disabled=${this.disabled}
        @change=${this.onChange}
      />
      <label for=${this.inputId} class="${labelClasses} ${dividerHidden}">
        <span class="tw-whitespace-nowrap"><slot></slot></span>
        <span class="tw-shrink-0 tw-flex" ?hidden=${!hasBerry}><slot name="berry"></slot></span>
      </label>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bit-toggle": BitToggle;
  }
}
