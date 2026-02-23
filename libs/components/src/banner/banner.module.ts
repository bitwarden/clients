import { NgModule } from "@angular/core";

import { BannerTitleDirective } from "./banner-title.directive";
import { BannerComponent } from "./banner.component";

@NgModule({
  imports: [BannerComponent, BannerTitleDirective],
  exports: [BannerComponent, BannerTitleDirective],
})
export class BannerModule {}
