import { CdkStepperModule } from "@angular/cdk/stepper";
import { TitleCasePipe } from "@angular/common";
import { NgModule } from "@angular/core";

import { FormFieldModule } from "@bitwarden/components";

import { OrganizationCreateModule } from "../../admin-console/organizations/create/organization-create.module";
import { RegisterFormModule } from "../../auth/register-form/register-form.module";
import { SecretsManagerTrialFreeStepperComponent } from "../../auth/trial-initiation/secrets-manager/secrets-manager-trial-free-stepper.component";
import { SecretsManagerTrialPaidStepperComponent } from "../../auth/trial-initiation/secrets-manager/secrets-manager-trial-paid-stepper.component";
import { SecretsManagerTrialComponent } from "../../auth/trial-initiation/secrets-manager/secrets-manager-trial.component";
import { PaymentComponent, TaxInfoComponent } from "../../billing";
import { TrialBillingStepComponent } from "../../billing/accounts/trial-initiation/trial-billing-step.component";
import { EnvironmentSelectorModule } from "../../components/environment-selector/environment-selector.module";
import { SharedModule } from "../../shared";

import { ConfirmationDetailsComponent } from "./confirmation-details.component";
import { AbmEnterpriseContentComponent } from "./content/abm-enterprise-content.component";
import { AbmTeamsContentComponent } from "./content/abm-teams-content.component";
import { CnetEnterpriseContentComponent } from "./content/cnet-enterprise-content.component";
import { CnetIndividualContentComponent } from "./content/cnet-individual-content.component";
import { CnetTeamsContentComponent } from "./content/cnet-teams-content.component";
import { DefaultContentComponent } from "./content/default-content.component";
import { EnterpriseContentComponent } from "./content/enterprise-content.component";
import { Enterprise1ContentComponent } from "./content/enterprise1-content.component";
import { Enterprise2ContentComponent } from "./content/enterprise2-content.component";
import { LogoCnet5StarsComponent } from "./content/logo-cnet-5-stars.component";
import { LogoCnetComponent } from "./content/logo-cnet.component";
import { LogoForbesComponent } from "./content/logo-forbes.component";
import { LogoUSNewsComponent } from "./content/logo-us-news.component";
import { ReviewBlurbComponent } from "./content/review-blurb.component";
import { ReviewLogoComponent } from "./content/review-logo.component";
import { SecretsManagerContentComponent } from "./content/secrets-manager-content.component";
import { TeamsContentComponent } from "./content/teams-content.component";
import { Teams1ContentComponent } from "./content/teams1-content.component";
import { Teams2ContentComponent } from "./content/teams2-content.component";
import { Teams3ContentComponent } from "./content/teams3-content.component";
import { TrialInitiationComponent } from "./trial-initiation.component";
import { VerticalStepperModule } from "./vertical-stepper/vertical-stepper.module";

@NgModule({
  imports: [
    SharedModule,
    CdkStepperModule,
    VerticalStepperModule,
    FormFieldModule,
    RegisterFormModule,
    OrganizationCreateModule,
    EnvironmentSelectorModule,
    PaymentComponent,
    TaxInfoComponent,
    TrialBillingStepComponent,
  ],
  declarations: [
    TrialInitiationComponent,
    EnterpriseContentComponent,
    TeamsContentComponent,
    ConfirmationDetailsComponent,
    DefaultContentComponent,
    EnterpriseContentComponent,
    Enterprise1ContentComponent,
    Enterprise2ContentComponent,
    TeamsContentComponent,
    Teams1ContentComponent,
    Teams2ContentComponent,
    Teams3ContentComponent,
    CnetEnterpriseContentComponent,
    CnetIndividualContentComponent,
    CnetTeamsContentComponent,
    AbmEnterpriseContentComponent,
    AbmTeamsContentComponent,
    LogoCnet5StarsComponent,
    LogoCnetComponent,
    LogoForbesComponent,
    LogoUSNewsComponent,
    ReviewLogoComponent,
    SecretsManagerContentComponent,
    ReviewBlurbComponent,
    SecretsManagerTrialComponent,
    SecretsManagerTrialFreeStepperComponent,
    SecretsManagerTrialPaidStepperComponent,
  ],
  exports: [TrialInitiationComponent],
  providers: [TitleCasePipe],
})
export class TrialInitiationModule {}
