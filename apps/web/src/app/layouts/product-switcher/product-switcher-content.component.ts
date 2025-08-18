// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, ViewChild } from "@angular/core";

import { MenuComponent } from "@bitwarden/components";

import { ProductSwitcherService } from "./shared/product-switcher.service";

@Component({
  selector: "product-switcher-content",
  templateUrl: "./product-switcher-content.component.html",
  standalone: false,
})
export class ProductSwitcherContentComponent {
  @ViewChild("menu")
  menu: MenuComponent;

  constructor(private productSwitcherService: ProductSwitcherService) {}

  protected readonly products$ = this.productSwitcherService.products$;
}
