import { NgModule } from "@angular/core";

import { VaultCarouselSlideComponent } from "./carousel-slide/carousel-slide.component";
import { VaultCarouselComponent } from "./carousel.component";

@NgModule({
  imports: [VaultCarouselComponent, VaultCarouselSlideComponent],
  exports: [VaultCarouselComponent, VaultCarouselSlideComponent],
})
export class VaultCarouselModule {}
