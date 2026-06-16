import { NgModule } from "@angular/core";

import { LandingCardComponent } from "./landing-card.component";
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
    LandingCardComponent,
  ],
  exports: [
    LandingLayoutComponent,
    LandingHeaderComponent,
    LandingHeroComponent,
    LandingFooterComponent,
    LandingContentComponent,
    LandingCardComponent,
  ],
})
export class LandingLayoutModule {}
