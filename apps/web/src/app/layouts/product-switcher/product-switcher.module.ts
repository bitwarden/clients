import { A11yModule } from "@angular/cdk/a11y";
import { NgModule } from "@angular/core";
import { RouterModule } from "@angular/router";

import { NavigationModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { SharedModule } from "../../shared";

import { NavigationProductSwitcherComponent } from "./navigation-switcher/navigation-switcher.component";
import { ProductSwitcherContentComponent } from "./product-switcher-content.component";
import { ProductSwitcherComponent } from "./product-switcher.component";

@NgModule({
  imports: [SharedModule, A11yModule, RouterModule, NavigationModule, I18nPipe],
  declarations: [
    ProductSwitcherComponent,
    ProductSwitcherContentComponent,
    NavigationProductSwitcherComponent,
  ],
  exports: [ProductSwitcherComponent, NavigationProductSwitcherComponent],
})
export class ProductSwitcherModule {}
