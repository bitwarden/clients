import { Component, Input } from "@angular/core";

import { Product } from "./finish-sign-up/enums/product";

@Component({
  selector: "app-trial-confirmation-details",
  templateUrl: "confirmation-details.component.html",
})
export class ConfirmationDetailsComponent {
  @Input() email: string;
  @Input() orgLabel: string;
  @Input() product?: Product = Product.PasswordManager;

  protected readonly Product = Product;
}
