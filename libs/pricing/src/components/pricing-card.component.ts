import { NgClass, NgFor, NgIf } from "@angular/common";
import { Component, EventEmitter, input, Output } from "@angular/core";

import { PricingCardButton, PricingCardPrice } from "../types/pricing-card.types";

/**
 * A reusable UI-only component that displays pricing information in a card format.
 * This component has no external dependencies and performs no logic - it only displays data
 * and emits events when the button is clicked.
 */
@Component({
  selector: "bit-pricing-card",
  templateUrl: "./pricing-card.component.html",
  imports: [NgClass, NgFor, NgIf],
  host: {
    class:
      "tw-box-border tw-block tw-bg-background tw-text-main tw-border tw-border-secondary-300 tw-rounded-lg tw-p-6 tw-shadow-sm",
  },
})
export class PricingCardComponent {
  /** The card title */
  readonly title = input.required<string>();

  /** The card tagline (supports text-wrapping up to 2 lines) */
  readonly tagline = input.required<string>();

  /** Optional pricing information */
  readonly price = input<PricingCardPrice>();

  /** Button configuration */
  readonly button = input.required<PricingCardButton>();

  /** Optional list of features */
  readonly features = input<string[]>();

  /** Event emitted when the card button is clicked */
  @Output() readonly buttonClick = new EventEmitter<void>();

  /**
   * Handles button click events and emits the buttonClick event
   */
  onButtonClick(): void {
    this.buttonClick.emit();
  }
}
