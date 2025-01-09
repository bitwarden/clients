import { A11yModule } from "@angular/cdk/a11y";
import { NgModule } from "@angular/core";
import { RouterModule } from "@angular/router";

import { I18nPipe } from "@bitwarden/angular/platform/pipes/i18n.pipe";
import { NavigationModule } from "@bitwarden/components";

import { SharedModule } from "../../shared";

import { NavigationProductSwitcherComponent } from "./navigation-switcher/navigation-switcher.component";
import { ProductSwitcherContentComponent } from "./product-switcher-content.component";
import { ProductSwitcherComponent } from "./product-switcher.component";

@NgModule({
  imports: [SharedModule, A11yModule, RouterModule, NavigationModule],
  declarations: [
    ProductSwitcherComponent,
    ProductSwitcherContentComponent,
    NavigationProductSwitcherComponent,
  ],
  exports: [ProductSwitcherComponent, NavigationProductSwitcherComponent],
  providers: [I18nPipe],
})
export class ProductSwitcherModule {}
