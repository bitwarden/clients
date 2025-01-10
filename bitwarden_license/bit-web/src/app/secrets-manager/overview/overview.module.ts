import { NgModule } from "@angular/core";

import { BannerModule } from "@bitwarden/components";

// FIXME: remove `src` and fix import
// eslint-disable-next-line no-restricted-imports
import { OnboardingModule } from "../../../../../../apps/web/src/app/shared/components/onboarding/onboarding.module";
import { SecretsManagerSharedModule } from "../shared/sm-shared.module";

import { OverviewRoutingModule } from "./overview-routing.module";
import { OverviewComponent } from "./overview.component";
import { SectionComponent } from "./section.component";

@NgModule({
  imports: [SecretsManagerSharedModule, OverviewRoutingModule, OnboardingModule, BannerModule],
  declarations: [OverviewComponent, SectionComponent],
  providers: [],
})
export class OverviewModule {}
