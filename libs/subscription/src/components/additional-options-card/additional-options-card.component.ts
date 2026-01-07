import { Component, ChangeDetectionStrategy, output, input } from "@angular/core";

import { ButtonModule, CardComponent, TypographyModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

export type AdditionalOptionsCardAction = "download-license" | "cancel-subscription";

@Component({
  selector: "billing-additional-options-card",
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./additional-options-card.component.html",
  imports: [ButtonModule, CardComponent, TypographyModule, I18nPipe],
})
export class AdditionalOptionsCardComponent {
  readonly callsToActionDisabled = input<boolean>(false);
  readonly callToActionClicked = output<AdditionalOptionsCardAction>();
}
