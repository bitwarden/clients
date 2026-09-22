import { CdkStepperModule } from "@angular/cdk/stepper";
import { TitleCasePipe } from "@angular/common";
import { NgModule } from "@angular/core";

import { InputPasswordComponent } from "@bitwarden/auth/angular";
import { FormFieldModule } from "@bitwarden/components";

import { OrganizationInformationComponent } from "../../admin-console/organizations/create/organization-information.component";
import { SharedModule } from "../../shared";

import { CompleteTrialInitiationComponent } from "./complete-trial-initiation/complete-trial-initiation.component";
import { ConfirmationDetailsComponent } from "./confirmation-details.component";
import { TrialBillingStepComponent } from "./trial-billing-step/trial-billing-step.component";
import { VerticalStepperModule } from "./vertical-stepper/vertical-stepper.module";

@NgModule({
  imports: [
    SharedModule,
    CdkStepperModule,
    VerticalStepperModule,
    FormFieldModule,
    OrganizationInformationComponent,
    TrialBillingStepComponent,
    InputPasswordComponent,
  ],
  declarations: [CompleteTrialInitiationComponent, ConfirmationDetailsComponent],
  exports: [CompleteTrialInitiationComponent],
  providers: [TitleCasePipe],
})
export class TrialInitiationModule {}
