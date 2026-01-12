import { Component, ChangeDetectionStrategy, output, input } from "@angular/core";

import { ButtonModule, CardComponent, TypographyModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

export const AdditionalOptionsCardActions = {
  DownloadLicense: "download-license",
  CancelSubscription: "cancel-subscription",
} as const;

export type AdditionalOptionsCardAction =
  (typeof AdditionalOptionsCardActions)[keyof typeof AdditionalOptionsCardActions];

@Component({
  selector: "billing-additional-options-card",
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "./additional-options-card.component.html",
  imports: [ButtonModule, CardComponent, TypographyModule, I18nPipe],
})
export class AdditionalOptionsCardComponent {
  readonly downloadLicenseDisabled = input<boolean>(false);
  readonly cancelSubscriptionDisabled = input<boolean>(false);

  readonly callToActionClicked = output<AdditionalOptionsCardAction>();

  protected readonly actions = AdditionalOptionsCardActions;
}
