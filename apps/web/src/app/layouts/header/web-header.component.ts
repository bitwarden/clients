import { ChangeDetectionStrategy, Component, inject, input } from "@angular/core";
import { ActivatedRoute } from "@angular/router";
import { map, Observable } from "rxjs";

import { BannerModule, HeaderComponent } from "@bitwarden/components";

import { SharedModule } from "../../shared";
import { ProductSwitcherModule } from "../product-switcher/product-switcher.module";

import { AccountMenuComponent } from "./account-menu.component";

@Component({
  selector: "app-header",
  templateUrl: "./web-header.component.html",
  imports: [
    SharedModule,
    ProductSwitcherModule,
    BannerModule,
    HeaderComponent,
    AccountMenuComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WebHeaderComponent {
  private route = inject(ActivatedRoute);

  /**
   * Custom title that overrides the route data `titleId`
   */
  readonly title = input<string>();

  /**
   * Icon to show before the title
   */
  readonly icon = input<string>();

  protected routeData$: Observable<{ titleId: string }> = this.route.data.pipe(
    map((params) => {
      return {
        titleId: params.titleId,
      };
    }),
  );
}
