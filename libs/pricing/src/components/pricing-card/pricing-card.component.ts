import { CurrencyPipe } from "@angular/common";
import { ChangeDetectionStrategy, Component, input, output } from "@angular/core";

import {
  BadgeModule,
  BadgeVariant,
  BitwardenIcon,
  ButtonModule,
  ButtonType,
  CardComponent,
  IconModule,
  SvgModule,
  TypographyModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

/**
 * A reusable UI-only component that displays pricing information in a card format.
 * This component has no external dependencies and performs no logic - it only displays data
 * and emits events when the button is clicked.
 */
@Component({
  selector: "billing-pricing-card",
  templateUrl: "./pricing-card.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    BadgeModule,
    ButtonModule,
    SvgModule,
    IconModule,
    TypographyModule,
    CurrencyPipe,
    CardComponent,
    I18nPipe,
  ],
})
export class PricingCardComponent {
  readonly tagline = input.required<string>();
  readonly price = input<{
    amount: number;
    cadence: "month" | "monthly" | "year" | "annually";
    showPerUser?: boolean;
  }>();
  readonly button = input<{
    type: ButtonType;
    text: string;
    disabled?: boolean;
    icon?: { type: BitwardenIcon; position: "before" | "after" };
  }>();
  readonly features = input<string[]>();
  readonly activeBadge = input<{ text: string; variant?: BadgeVariant }>();

  readonly buttonClick = output<void>();
}
