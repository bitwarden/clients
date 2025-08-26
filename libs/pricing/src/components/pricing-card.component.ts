import { CommonModule } from "@angular/common";
import { Component, EventEmitter, Input, Output } from "@angular/core";

import { PricingCardButton, PricingCardPrice } from "../types/pricing-card.types";

/**
 * A reusable UI-only component that displays pricing information in a card format.
 * This component has no external dependencies and performs no logic - it only displays data
 * and emits events when the button is clicked.
 */
@Component({
  selector: "bit-pricing-card",
  templateUrl: "./pricing-card.component.html",
  imports: [CommonModule],
})
export class PricingCardComponent {
  @Input() title: string;
  @Input() tagline: string;
  @Input() price?: PricingCardPrice;
  @Input() button: PricingCardButton;
  @Input() features?: string[];

  @Output() buttonClick = new EventEmitter<void>();

  /**
   * Handles button click events and emits the buttonClick event
   */
  onButtonClick(): void {
    this.buttonClick.emit();
  }
}
