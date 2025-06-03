import { CommonModule } from "@angular/common";
import { Component } from "@angular/core";

import { LayoutComponent } from "@bitwarden/components";

import { ProductSwitcherModule } from "./product-switcher/product-switcher.module";

@Component({
  selector: "app-layout",
  templateUrl: "web-layout.component.html",
  imports: [CommonModule, LayoutComponent, ProductSwitcherModule],
})
export class WebLayoutComponent {
  constructor() {}
}
