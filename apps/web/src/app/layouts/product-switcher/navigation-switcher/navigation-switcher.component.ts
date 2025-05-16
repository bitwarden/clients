import { Component } from "@angular/core";
import { map, Observable } from "rxjs";

import { ProductSwitcherItem, ProductSwitcherService } from "../shared/product-switcher.service";

@Component({
  selector: "navigation-product-switcher",
  templateUrl: "./navigation-switcher.component.html",
  standalone: false,
})
export class NavigationProductSwitcherComponent {
  constructor(private productSwitcherService: ProductSwitcherService) {}

  protected readonly accessibleProducts$: Observable<ProductSwitcherItem[]> =
    this.productSwitcherService.products$.pipe(map((products) => products.bento ?? []));

  protected readonly moreProducts$: Observable<ProductSwitcherItem[]> =
    this.productSwitcherService.products$.pipe(
      map((products) => products.other ?? []),
      // Ensure that organizations is displayed first in the other products list
      // This differs from the order in `ProductSwitcherContentComponent` but matches the intent
      // from product & design
      map((products) => products.sort((product) => (product.name === "Organizations" ? -1 : 1))),
    );
}
