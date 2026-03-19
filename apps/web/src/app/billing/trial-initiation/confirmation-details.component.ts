// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, Input } from "@angular/core";

import { ProductType } from "@bitwarden/common/billing/enums";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "app-trial-confirmation-details",
  templateUrl: "confirmation-details.component.html",
  standalone: false,
})
export class ConfirmationDetailsComponent {
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() email: string;
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() orgLabel: string;
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() product?: ProductType = ProductType.PasswordManager;
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @Input() trialLength: number;

  protected readonly Product = ProductType;
}
