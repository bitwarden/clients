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
