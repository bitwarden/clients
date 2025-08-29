import { Component, EventEmitter, input, Output } from "@angular/core";

import { ButtonModule, ButtonType, IconModule, TypographyModule } from "@bitwarden/components";

/**
 * A reusable UI-only component that displays pricing information in a card format.
 * This component has no external dependencies and performs no logic - it only displays data
 * and emits events when the button is clicked.
 */
@Component({
  selector: "billing-pricing-card",
  templateUrl: "./pricing-card.component.html",
  imports: [ButtonModule, IconModule, TypographyModule],
})
export class PricingCardComponent {
  tagline = input.required<string>();
  price = input<{ amount: number; cadence: "monthly" | "annually"; showPerUser?: boolean }>();
  button = input<{ type: ButtonType; text: string; disabled?: boolean }>();
  features = input<string[]>();
  activeBadge = input<{ text: string; show: boolean }>({ text: "Active plan", show: false });

  @Output() buttonClick = new EventEmitter<void>();

  /**
   * Handles button click events and emits the buttonClick event
   */
  onButtonClick(): void {
    this.buttonClick.emit();
  }
}
