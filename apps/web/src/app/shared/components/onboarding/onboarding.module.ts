import { NgModule } from "@angular/core";

import { ProgressBarComponent } from "@bitwarden/components";

import { SharedModule } from "../../shared.module";

import { OnboardingTaskComponent } from "./onboarding-task.component";
import { OnboardingComponent } from "./onboarding.component";

@NgModule({
  imports: [SharedModule, ProgressBarComponent],
  exports: [OnboardingComponent, OnboardingTaskComponent],
  declarations: [OnboardingComponent, OnboardingTaskComponent],
})
export class OnboardingModule {}
