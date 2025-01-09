// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, Input } from "@angular/core";

import { ProductType } from "@bitwarden/common/billing/enums";

@Component({
  selector: "app-trial-confirmation-details",
  templateUrl: "confirmation-details.component.html",
})
export class ConfirmationDetailsComponent {
  @Input() email: string;
  @Input() orgLabel: string;
  @Input() product?: ProductType = ProductType.PasswordManager;

  protected readonly Product = ProductType;
}
