import { NgModule } from "@angular/core";

import { StepComponent } from "./step.component";
import { StepperComponent } from "./stepper.component";

@NgModule({
  imports: [StepperComponent, StepComponent],
  exports: [StepperComponent, StepComponent],
})
export class StepperModule {}
