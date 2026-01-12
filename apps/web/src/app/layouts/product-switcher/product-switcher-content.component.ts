// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, ViewChild } from "@angular/core";

import { MenuComponent } from "@bitwarden/components";

import { ProductSwitcherService } from "./shared/product-switcher.service";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "product-switcher-content",
  templateUrl: "./product-switcher-content.component.html",
  standalone: false,
})
export class ProductSwitcherContentComponent {
  // FIXME(https://bitwarden.atlassian.net/browse/CL-903): Migrate to Signals
  // eslint-disable-next-line @angular-eslint/prefer-signals
  @ViewChild("menu")
  menu: MenuComponent;

  constructor(private productSwitcherService: ProductSwitcherService) {}

  protected readonly products$ = this.productSwitcherService.products$;
}
