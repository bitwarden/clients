import { CommonModule } from "@angular/common";
import { Component } from "@angular/core";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { LayoutComponent } from "@bitwarden/components";

import { PaymentMethodWarningsModule } from "../billing/shared";

import { ProductSwitcherModule } from "./product-switcher/product-switcher.module";
import { ToggleWidthComponent } from "./toggle-width.component";

@Component({
  selector: "app-layout",
  templateUrl: "web-layout.component.html",
  standalone: true,
  imports: [
    CommonModule,
    LayoutComponent,
    ProductSwitcherModule,
    ToggleWidthComponent,
    PaymentMethodWarningsModule,
  ],
})
export class WebLayoutComponent {
  protected showPaymentMethodWarningBanners$ = this.configService.getFeatureFlag$(
    FeatureFlag.ShowPaymentMethodWarningBanners,
  );

  constructor(private configService: ConfigService) {}
}
