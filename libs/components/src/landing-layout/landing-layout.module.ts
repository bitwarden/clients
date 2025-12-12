import { NgModule } from "@angular/core";

import { LandingContentComponent } from "./components/content.component";
import { LandingFooterComponent } from "./components/footer.component";
import { LandingHeaderComponent } from "./components/header.component";
import { LandingLayoutComponent } from "./landing-layout.component";

@NgModule({
  imports: [
    LandingLayoutComponent,
    LandingHeaderComponent,
    LandingFooterComponent,
    LandingContentComponent,
  ],
  exports: [
    LandingLayoutComponent,
    LandingHeaderComponent,
    LandingFooterComponent,
    LandingContentComponent,
  ],
})
export class LandingLayoutModule {}
