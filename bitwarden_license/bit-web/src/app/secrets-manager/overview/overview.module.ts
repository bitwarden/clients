import { NgModule } from "@angular/core";

import { BannerModule } from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";
import { OrganizationFreeTrialWarningComponent } from "@bitwarden/web-vault/app/billing/organizations/warnings/components";
import { OnboardingTaskComponent } from "@bitwarden/web-vault/app/vault/components/onboarding/onboarding-task.component";
import { OnboardingComponent } from "@bitwarden/web-vault/app/vault/components/onboarding/onboarding.component";

import { SecretsManagerSharedModule } from "../shared/sm-shared.module";

import { OverviewRoutingModule } from "./overview-routing.module";
import { OverviewComponent } from "./overview.component";
import { SectionComponent } from "./section.component";

@NgModule({
  imports: [
    SecretsManagerSharedModule,
    OverviewRoutingModule,
    OnboardingComponent,
    OnboardingTaskComponent,
    BannerModule,
    OrganizationFreeTrialWarningComponent,
    I18nPipe,
  ],
  declarations: [OverviewComponent, SectionComponent],
  providers: [],
})
export class OverviewModule {}
