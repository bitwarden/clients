import { NgModule } from "@angular/core";

import { VerticalStep } from "./vertical-step.component";
import { VerticalStepperComponent } from "./vertical-stepper.component";

@NgModule({
  imports: [VerticalStepperComponent, VerticalStep],
  exports: [VerticalStepperComponent, VerticalStep],
})
export class VerticalStepperModule {}
