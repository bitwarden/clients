import { ChangeDetectionStrategy, Component, input } from "@angular/core";

import { SideNavVariant, NavigationModule } from "@bitwarden/components";

import { ProductSwitcherModule } from "./product-switcher/product-switcher.module";

@Component({
  selector: "app-side-nav",
  templateUrl: "web-side-nav.component.html",
  imports: [NavigationModule, ProductSwitcherModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WebSideNavComponent {
  readonly variant = input<SideNavVariant>("primary");
}
