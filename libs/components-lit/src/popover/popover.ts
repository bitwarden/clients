import { html, PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import { t } from "../core/i18n";
import "../icon-button/icon-button";

import { DeclarativePopoverController } from "./declarative";
import { BitPopoverBase } from "./popover-base";
import { PopoverPosition } from "./popover-position";

/**
 * Overlay with contextual help or a guided-tour step. Opens next to an anchor and traps focus until
 * dismissed by the close button, Escape, or an outside click.
 *
 * Open it with `attachPopoverTrigger` / the `popoverTrigger()` directive (toggles on click),
 * `attachPopoverAnchor` / `popoverAnchor()` (programmatic), `openPopover()`, or declaratively with
 * the `trigger` / `anchor` attributes.
 *
 * @slot - Body content.
 * @slot header - A `bit-popover-header` (assigned automatically).
 * @slot footer - A `bit-popover-footer` (assigned automatically).
 * @fires closed - The close button was pressed.
 * @fires openChange - The popover opened or closed. `detail: { open: boolean }`.
 */
@customElement("bit-popover")
export class BitPopover extends BitPopoverBase {
  /** Heading, also the dialog's accessible name. (`title` would show a native tooltip.) */
  @property() heading = "";

  /** Id of an element in the same root that toggles the popover on click. */
  @property() trigger?: string;

  /** Id of an element in the same root to anchor to; open it with the `open` property. */
  @property() anchor?: string;

  /** With `anchor`/`trigger`: whether the popover is open. Updated when the user dismisses it. */
  @property({ type: Boolean, reflect: true }) open = false;

  /** With `anchor`/`trigger`: preferred position. */
  @property() position?: PopoverPosition;

  /** With `anchor`/`trigger`: dim everything except the anchor. */
  @property({ type: Boolean }) spotlight = false;

  @state() private hasHeader = false;

  private readonly declarative = new DeclarativePopoverController(this);

  protected get accessibleName() {
    return this.heading;
  }

  protected updated(changed: PropertyValues<this>) {
    super.updated(changed);
    this.declarative.sync();
  }

  private onCloseClick = () => {
    this.dispatchEvent(new CustomEvent("closed", { bubbles: true, composed: true }));
  };

  render() {
    return this.renderShell(html`
      <slot
        name="header"
        @slotchange=${(e: Event) => (this.hasHeader = (e.target as HTMLSlotElement).assignedElements().length > 0)}
      ></slot>
      <div class="tw-p-6">
        <div class="tw-absolute tw-top-3 tw-end-3">
          <bit-icon-button
            data-testid="bit-popover-close"
            icon="bwi-close"
            button-type=${this.hasHeader ? "secondary" : "primaryGhost"}
            size="small"
            label=${t("close")}
            @click=${this.onCloseClick}
          ></bit-icon-button>
        </div>
        <div class="tw-flex tw-flex-col tw-gap-6">
          <div class="tw-flex tw-flex-col tw-gap-3">
            <h2
              data-testid="bit-popover-title"
              class="tw-m-0 tw-text-lg tw-font-medium tw-text-fg-heading ${this.hasHeader ? "" : "tw-pe-7"}"
            >
              ${this.heading}
            </h2>
            <div data-testid="bit-popover-body" class="tw-text-sm tw-text-fg-body">
              <slot></slot>
            </div>
          </div>
          <slot name="footer"></slot>
        </div>
      </div>
    `);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "bit-popover": BitPopover;
  }
}
