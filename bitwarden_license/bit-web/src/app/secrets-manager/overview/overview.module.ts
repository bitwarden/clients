import { NgModule } from "@angular/core";

import { BannerModule } from "@bitwarden/components";
import { OrganizationFreeTrialWarningComponent } from "@bitwarden/web-vault/app/billing/organizations/warnings/components";
import { OrganizationWarningsModule } from "@bitwarden/web-vault/app/billing/organizations/warnings/organization-warnings.module";
import { OnboardingModule } from "@bitwarden/web-vault/app/shared/components/onboarding/onboarding.module";

import { SecretsManagerSharedModule } from "../shared/sm-shared.module";

import { OverviewRoutingModule } from "./overview-routing.module";
import { OverviewComponent } from "./overview.component";
import { SectionComponent } from "./section.component";

@NgModule({
  imports: [
    SecretsManagerSharedModule,
    OverviewRoutingModule,
    OnboardingModule,
    BannerModule,
    OrganizationFreeTrialWarningComponent,
    OrganizationWarningsModule,
  ],
  declarations: [OverviewComponent, SectionComponent],
  providers: [],
})
export class OverviewModule {}
