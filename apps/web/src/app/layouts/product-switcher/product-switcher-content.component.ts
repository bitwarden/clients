import { ChangeDetectionStrategy, Component, inject, viewChild } from "@angular/core";

import { MenuComponent } from "@bitwarden/components";

import { ProductSwitcherService } from "./shared/product-switcher.service";

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: "product-switcher-content",
  templateUrl: "./product-switcher-content.component.html",
  standalone: false,
})
export class ProductSwitcherContentComponent {
  private readonly productSwitcherService = inject(ProductSwitcherService);

  readonly menu = viewChild<MenuComponent>("menu");

  protected readonly products$ = this.productSwitcherService.products$;
}
