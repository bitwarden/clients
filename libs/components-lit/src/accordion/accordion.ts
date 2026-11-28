import { ContextConsumer } from "@lit/context";
import { css, html, nothing, PropertyValues } from "lit";
import { customElement, property } from "lit/decorators.js";

import "../icon-tile/icon-tile";
import { BitElement } from "../core/bit-element";
import { uniqueId } from "../core/ids";
import "../icon/icon";
import { BitwardenIcon } from "../icon/shared-icon";

import { accordionGroupContext } from "./accordion-context";

export type AccordionSize = "sm" | "default";
export type AccordionVariant = "default" | "subtle";
export type AccordionHeight = "constrained" | "auto";

/**
 * Expandable container for progressively disclosing content. Group several in
 * `bit-accordion-group`.
 *
 * @slot - Panel content
 * @slot end - Extra header content before the chevron, e.g. a badge
 * @fires openChange - `detail` is the new `open` value, after a user toggle or a single-select
 *   group closing this accordion
 */
@customElement("bit-accordion")
export class BitAccordion extends BitElement {
  static styles = [
    BitElement.styles,
    css`
      :host {
        display: block;
      }
      /* On an inner element: the document's preflight border reset would override :host borders. */
      .frame {
        box-sizing: border-box;
        border: 1px solid var(--color-border-base);
        border-radius: 0.75rem;
      }
      /* Collapse inner radii and borders when stacked inside a group */
      :host([grouped]:not(:first-of-type)) .frame,
      :host([grouped]:not(:first-of-type)) .trigger {
        border-start-start-radius: 0;
        border-start-end-radius: 0;
      }
      :host([grouped]:not(:last-of-type)) .frame,
      :host([grouped]:not(:last-of-type)) .trigger,
      :host([grouped]:not(:last-of-type)) .content {
        border-end-start-radius: 0;
        border-end-end-radius: 0;
      }
      :host([grouped]:not(:last-of-type)) .frame {
        border-block-end-width: 0;
      }
    `,
  ];

  /** Header text. */
  @property() heading = "";

  /** Secondary header text. Hidden in the `sm` size. */
  @property() subtitle?: string;

  @property({ type: Boolean, reflect: true }) open = false;

  /** Icon tile shown before the heading. */
  @property({ attribute: "start-icon" }) startIcon?: BitwardenIcon;

  /** Prevents opening or closing. */
  @property({ type: Boolean, reflect: true }) disabled = false;

  @property({ reflect: true }) size: AccordionSize = "default";

  /** Overridden by an enclosing `bit-accordion-group`'s variant. */
  @property({ reflect: true }) variant: AccordionVariant = "default";

  /** `constrained` caps the panel height and scrolls; `auto` sizes it to the content. */
  @property() height: AccordionHeight = "constrained";

  private readonly group = new ContextConsumer(this, {
    context: accordionGroupContext,
    subscribe: true,
  });
  private readonly baseId = uniqueId("bit-accordion");

  private get resolvedVariant() {
    return this.group.value?.variant ?? this.variant;
  }

  /** Sets `open` and fires `openChange`. */
  setOpen(open: boolean) {
    if (open === this.open) {
      return;
    }
    this.open = open;
    this.dispatchEvent(
      new CustomEvent<boolean>("openChange", { detail: open, bubbles: true, composed: true }),
    );
  }

  private toggle() {
    if (!this.disabled) {
      this.setOpen(!this.open);
    }
  }

  protected updated(changed: PropertyValues<this>) {
    this.toggleAttribute("grouped", !!this.group.value);
    if (changed.has("open") && this.open) {
      this.group.value?.notifyOpened(this);
    }
  }

  render() {
    const small = this.size === "sm";
    const triggerId = `${this.baseId}-trigger`;
    const contentId = `${this.baseId}-content`;
    const inactiveOr = (active: string) => (this.disabled ? "tw-text-fg-inactive" : active);

    const triggerClasses = [
      "trigger tw-flex tw-items-center tw-gap-3 tw-w-full tw-border-0 tw-text-start tw-cursor-pointer",
      "[transition:background-color_150ms_ease] tw-rounded-t-xl",
      this.open ? "" : "tw-rounded-b-xl",
      this.resolvedVariant === "default" ? "tw-bg-bg-secondary" : "tw-bg-bg-primary",
      "enabled:hover:tw-bg-bg-hover focus-visible:tw-outline-none focus-visible:tw-ring-2",
      "focus-visible:tw-ring-inset focus-visible:tw-ring-border-focus focus-visible:tw-border-border-focus",
      "disabled:tw-cursor-not-allowed disabled:tw-text-fg-inactive",
      small ? "tw-p-3" : "tw-p-4",
    ].join(" ");

    const contentClasses = [
      "content tw-grid tw-rounded-b-xl tw-overflow-hidden tw-transition-[grid-template-rows,padding] tw-duration-150",
      this.resolvedVariant === "subtle" && this.open
        ? "tw-border-0 tw-border-t tw-border-solid tw-border-border-base"
        : "",
      this.open ? "tw-grid-rows-[1fr] tw-py-4" : "tw-grid-rows-[0fr] tw-py-0",
    ].join(" ");

    return html`<div class="frame">
      <button
        type="button"
        part="trigger"
        id=${triggerId}
        class=${triggerClasses}
        ?disabled=${this.disabled}
        aria-expanded=${String(this.open)}
        aria-controls=${contentId}
        @click=${this.toggle}
      >
        ${
          this.startIcon
            ? html`<bit-icon-tile
                icon=${this.startIcon}
                variant="gray"
                size=${small ? "base" : "lg"}
              ></bit-icon-tile>`
            : nothing
        }
        <div class="tw-flex tw-flex-col tw-flex-1 tw-min-w-0 tw-gap-1 tw-items-start">
          <span
            class="tw-font-medium tw-leading-6 ${small ? "tw-text-base" : "tw-text-lg"} ${inactiveOr(
              "tw-text-fg-heading",
            )}"
            >${this.heading}</span
          >
          ${
            !small && this.subtitle
              ? html`<span class="tw-text-sm/5 ${inactiveOr("tw-text-fg-body")}"
                  >${this.subtitle}</span
                >`
              : nothing
          }
        </div>
        <slot name="end"></slot>
        <bit-icon
          name=${this.open ? "bwi-angle-up" : "bwi-angle-down"}
          class="tw-text-xl tw-shrink-0 ${inactiveOr("tw-text-fg-heading")}"
        ></bit-icon>
      </button>
      <div
        part="content"
        id=${contentId}
        role="region"
        aria-labelledby=${triggerId}
        class=${contentClasses}
        aria-hidden=${String(!this.open)}
        ?inert=${!this.open}
      >
        <div
          class="tw-min-h-0 tw-px-4 ${
            this.height === "constrained" ? "tw-max-h-80 tw-overflow-y-auto" : ""
          }"
        >
          <slot></slot>
        </div>
      </div>
    </div>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bit-accordion": BitAccordion;
  }
}
