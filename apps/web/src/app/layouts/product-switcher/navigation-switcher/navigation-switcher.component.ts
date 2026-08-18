import { AsyncPipe, NgTemplateOutlet } from "@angular/common";
import { ChangeDetectionStrategy, Component, inject } from "@angular/core";
import { RouterModule } from "@angular/router";
import { map, Observable } from "rxjs";

import {
  MenuModule,
  NavigationModule,
  IconComponent,
  SideNavService,
  IconTileComponent,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { UpgradeNavButtonComponent } from "../../../billing/individual/upgrade/upgrade-nav-button/upgrade-nav-button/upgrade-nav-button.component";
import { ProductSwitcherItem, ProductSwitcherService } from "../shared/product-switcher.service";

@Component({
  selector: "navigation-product-switcher",
  templateUrl: "./navigation-switcher.component.html",
  imports: [
    AsyncPipe,
    NgTemplateOutlet,
    RouterModule,
    MenuModule,
    NavigationModule,
    I18nPipe,
    UpgradeNavButtonComponent,
    IconComponent,
    IconTileComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NavigationProductSwitcherComponent {
  constructor(private readonly productSwitcherService: ProductSwitcherService) {}

  private readonly sideNavService = inject(SideNavService);

  protected readonly sideNavOpen = this.sideNavService.open;
  protected readonly sideNavWidthRem = this.sideNavService.widthRem;
  protected readonly version = this.sideNavService.version;

  protected readonly shouldShowPremiumUpgradeButton$: Observable<boolean> =
    this.productSwitcherService.shouldShowPremiumUpgradeButton$;

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

  protected readonly activeProduct$: Observable<ProductSwitcherItem | undefined> =
    this.productSwitcherService.products$.pipe(
      map((products) => (products.bento ?? []).find((product) => product.isActive)),
    );
}
