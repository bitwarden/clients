import { CommonModule } from "@angular/common";
import { Component } from "@angular/core";

import { LayoutComponent } from "@bitwarden/components";

import { ProductSwitcherModule } from "./product-switcher/product-switcher.module";
import { ToggleWidthComponent } from "./toggle-width.component";

@Component({
  selector: "app-layout",
  templateUrl: "web-layout.component.html",
  standalone: true,
  imports: [CommonModule, LayoutComponent, ProductSwitcherModule, ToggleWidthComponent],
})
export class WebLayoutComponent {
  constructor() {}
}
