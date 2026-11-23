import { ChangeDetectionStrategy, Component, inject, input } from "@angular/core";

import { ButtonType } from "@bitwarden/components";

import { ProductSwitcherService } from "./shared/product-switcher.service";
@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: "product-switcher",
  templateUrl: "./product-switcher.component.html",
  standalone: false,
})
export class ProductSwitcherComponent {
  private readonly productSwitcherService = inject(ProductSwitcherService);

  /**
   * Passed to the product switcher's `bitIconButton`
   */
  readonly buttonType = input<ButtonType>("secondary");

  protected readonly products$ = this.productSwitcherService.products$;
}
