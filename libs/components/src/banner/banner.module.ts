import { NgModule } from "@angular/core";

import { BannerComponent } from "./banner.component";

/**
 * Module providing the banner component for important user notifications.
 */
@NgModule({
  imports: [BannerComponent],
  exports: [BannerComponent],
})
export class BannerModule {}
