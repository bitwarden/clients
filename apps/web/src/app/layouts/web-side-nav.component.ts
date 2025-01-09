import { CommonModule } from "@angular/common";
import { Component, Input } from "@angular/core";

import { SideNavVariant, NavigationModule } from "@bitwarden/components";

import { ProductSwitcherModule } from "./product-switcher/product-switcher.module";
import { ToggleWidthComponent } from "./toggle-width.component";

@Component({
  selector: "app-side-nav",
  templateUrl: "web-side-nav.component.html",
  standalone: true,
  imports: [CommonModule, NavigationModule, ProductSwitcherModule, ToggleWidthComponent],
})
export class WebSideNavComponent {
  @Input() variant: SideNavVariant = "primary";
}
