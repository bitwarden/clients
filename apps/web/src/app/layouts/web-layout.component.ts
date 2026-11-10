import { CommonModule } from "@angular/common";
import { ChangeDetectionStrategy, Component } from "@angular/core";

import { LayoutComponent } from "@bitwarden/components";

import { ProductSwitcherModule } from "./product-switcher/product-switcher.module";

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: "app-layout",
  templateUrl: "web-layout.component.html",
  imports: [CommonModule, LayoutComponent, ProductSwitcherModule],
})
export class WebLayoutComponent {}
