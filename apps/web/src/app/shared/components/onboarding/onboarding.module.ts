import { NgModule } from "@angular/core";

import { OnboardingTaskComponent } from "./onboarding-task.component";
import { OnboardingComponent } from "./onboarding.component";

@NgModule({
  imports: [OnboardingComponent, OnboardingTaskComponent],
  exports: [OnboardingComponent, OnboardingTaskComponent],
})
export class OnboardingModule {}
