import { ChangeDetectionStrategy, Component, input, output } from "@angular/core";

import {
  BitwardenIcon,
  ButtonModule,
  CardComponent,
  IconComponent,
  TypographyModule,
} from "@bitwarden/components";

/**
 * A generic billing error card: an icon badge, a title, a description, and an optional action
 * button. All copy is passed in already-localized so the card is reusable across surfaces
 * (subscription failed to load, payment declined, etc.).
 */
@Component({
  selector: "billing-error-card",
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./error-card.component.html",
  imports: [ButtonModule, CardComponent, IconComponent, TypographyModule],
})
export class ErrorCardComponent {
  /** Heading text, already localized. */
  readonly title = input.required<string>();

  /** Body text explaining the error, already localized. */
  readonly description = input.required<string>();

  /** Action button label, already localized. When omitted, no button renders. */
  readonly buttonText = input<string>();

  /** Icon shown in the header badge. */
  readonly icon = input<BitwardenIcon>("bwi-error");

  /** Utility classes applied to the icon, e.g. to change its color for a danger vs. warning error. */
  readonly iconClass = input<string>("tw-text-lg tw-text-fg-warning");

  /** Emitted when the action button is clicked. */
  readonly actionClicked = output<void>();
}
