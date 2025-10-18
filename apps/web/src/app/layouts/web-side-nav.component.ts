import { CommonModule } from "@angular/common";
import { Component, Input } from "@angular/core";

import { SideNavVariant, NavigationModule } from "@bitwarden/components";

import { ProductSwitcherModule } from "./product-switcher/product-switcher.module";

@Component({
  selector: "app-side-nav",
  templateUrl: "web-side-nav.component.html",
  imports: [CommonModule, NavigationModule, ProductSwitcherModule],
})
export class WebSideNavComponent {
  @Input() variant: SideNavVariant = "primary";
}
