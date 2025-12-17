import { ChangeDetectionStrategy, Component, output } from "@angular/core";

import { ButtonModule, CardComponent, TypographyModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

/**
 * A reusable UI-only component that displays additional subscription options with action buttons.
 * This component has no external dependencies and performs no logic - it only displays content
 * and emits events when buttons are clicked.
 */
@Component({
  selector: "billing-additional-options-card",
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./additional-options-card.component.html",
  imports: [ButtonModule, CardComponent, TypographyModule, I18nPipe],
})
export class AdditionalOptionsCardComponent {
  readonly downloadLicenseClicked = output<void>();
  readonly cancelSubscriptionClicked = output<void>();
}
