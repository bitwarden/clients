import { html, nothing } from "lit";
import { customElement } from "lit/decorators.js";
import { live } from "lit/directives/live.js";

import { BitChoiceElement } from "../form-control/choice-element";
import { ChoiceIds } from "../form-control/choice-layout";

/**
 * Switch for toggling between two states (Angular `<bit-form-control>` + `<bit-switch>`). Switch
 * actions are meant to take place immediately and are not to be used in a form where
 * saving/submitting actions are required.
 *
 * Disabled switches stay focusable (`aria-disabled`). Cards use the large size.
 *
 * Inherits the slots and events of `BitChoiceElement`.
 */
@customElement("bit-switch")
export class BitSwitch extends BitChoiceElement {
  private get large() {
    return this.card;
  }

  private get trackClasses() {
    const disabled = this.isDisabled;
    return [
      // outline supports forced-colors mode
      "tw-outline-none",
      "tw-flex",
      "tw-relative",
      "tw-shrink-0",
      "tw-rounded-full",
      "tw-text-fg-brand",
      "after:tw-content-['']",
      "after:tw-transition-[background-color]",
      "after:tw-absolute",
      "after:tw-inset-0",
      "after:tw-rounded-full",
      "after:tw-size-full",
      ...(this.large ? ["!tw-w-11", "!tw-h-6"] : ["!tw-w-8", "tw-h-[1.125rem]"]),
      ...(disabled
        ? // design calls for using a bg color as a text color which the config does not allow
          ["tw-bg-bg-inactive", "tw-text-[var(--color-bg-inactive)]"]
        : this.checked
          ? [
              "tw-bg-bg-brand",
              "[&:has(input:focus-visible)]:after:tw-bg-bg-brand-strong",
              "[&:has(input:focus-visible)]:tw-text-fg-brand-strong",
              "[label:hover_&]:after:tw-bg-bg-brand-strong",
              "[label:hover_&]:tw-text-fg-brand-strong",
            ]
          : [
              "tw-bg-bg-gray",
              "[&:has(input:focus-visible)]:after:tw-bg-bg-gray-strong",
              "[label:hover_&]:after:tw-bg-bg-gray-strong",
            ]),
    ].join(" ");
  }

  private get thumbClasses() {
    return [
      // outline supports forced-colors mode
      "tw-outline-none",
      "tw-flex",
      "tw-items-center",
      "tw-justify-center",
      "tw-absolute",
      "tw-z-[2]",
      "tw-block",
      "tw-bg-text-alt2",
      "tw-rounded-full",
      "tw-shadow-md",
      "tw-transform",
      "tw-transition-transform",
      ...(this.large
        ? ["tw-size-[1.125rem]", "tw-top-[3px]", "tw-start-[3px]"]
        : ["tw-size-3.5", "tw-top-[2px]", "tw-start-[2px]"]),
      ...(this.large && this.checked
        ? [
            "tw-translate-x-[calc(theme(spacing.11)_-_(1.125rem_+_6px))]",
            "rtl:-tw-translate-x-[calc(theme(spacing.11)_-_(1.125rem_+_6px))]",
          ]
        : []),
      ...(!this.large && this.checked
        ? [
            "tw-translate-x-[calc(theme(spacing.8)_-_(.875rem_+_4px))]",
            "rtl:-tw-translate-x-[calc(theme(spacing.8)_-_(.875rem_+_4px))]",
          ]
        : []),
      // design calls for using a fg color as a bg color which the config does not allow
      ...(this.isDisabled && this.checked ? ["tw-bg-[var(--color-fg-inactive)]"] : []),
    ].join(" ");
  }

  protected renderControl() {
    const indicator = [
      "bwi",
      "bwi-check",
      "tw-transition-opacity",
      this.checked ? "tw-opacity-100" : "tw-opacity-0",
      this.large ? "tw-text-[.875rem]" : "tw-text-[.75rem]",
    ].join(" ");
    return html`<div class="tw-p-[3px] tw-relative">
      <span class=${this.trackClasses}>
        <input
          id=${ChoiceIds.control}
          type="checkbox"
          role="switch"
          class="tw-sr-only tw-absolute tw-size-full"
          .checked=${live(this.checked)}
          ?required=${this.required}
          aria-disabled=${this.isDisabled ? "true" : nothing}
          aria-labelledby=${ChoiceIds.label}
          aria-describedby=${this.describedBy ?? nothing}
          aria-invalid=${this.showErrors ? "true" : nothing}
          @click=${this.onSwitchClick}
          @change=${this.onInputChange}
          @blur=${this.markTouchedOnBlur}
        />
        <span class=${this.thumbClasses}>
          <i class=${indicator} aria-hidden="true"></i>
        </span>
      </span>
    </div>`;
  }

  private onSwitchClick = (event: MouseEvent) => {
    if (this.isDisabled) {
      event.preventDefault();
    }
  };
}

declare global {
  interface HTMLElementTagNameMap {
    "bit-switch": BitSwitch;
  }
}
