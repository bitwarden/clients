import { NgModule } from "@angular/core";

import { StepComponent } from "./step.component";
import { StepperComponent } from "./stepper.component";

/**
 * Module providing stepper components for multi-step workflows.
 */
@NgModule({
  imports: [StepperComponent, StepComponent],
  exports: [StepperComponent, StepComponent],
})
export class StepperModule {}
