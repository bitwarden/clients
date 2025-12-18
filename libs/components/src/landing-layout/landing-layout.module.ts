import { NgModule } from "@angular/core";

import { LandingContentComponent } from "./landing-content.component";
import { LandingFooterComponent } from "./landing-footer.component";
import { LandingHeaderComponent } from "./landing-header.component";
import { LandingHeroComponent } from "./landing-hero.component";
import { LandingLayoutComponent } from "./landing-layout.component";

@NgModule({
  imports: [
    LandingLayoutComponent,
    LandingHeaderComponent,
    LandingHeroComponent,
    LandingFooterComponent,
    LandingContentComponent,
  ],
  exports: [
    LandingLayoutComponent,
    LandingHeaderComponent,
    LandingHeroComponent,
    LandingFooterComponent,
    LandingContentComponent,
  ],
})
export class LandingLayoutModule {}
