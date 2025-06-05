// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, Input } from "@angular/core";

import { ProductType } from "@bitwarden/common/billing/enums";

@Component({
  selector: "app-trial-confirmation-details",
  templateUrl: "confirmation-details.component.html",
  standalone: false,
})
export class ConfirmationDetailsComponent {
  @Input() email: string;
  @Input() orgLabel: string;
  @Input() product?: ProductType = ProductType.PasswordManager;
  @Input() trialLength: number;

  protected readonly Product = ProductType;
}
