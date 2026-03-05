import { NgModule } from "@angular/core";

import { SharedModule } from "../../../shared";

import { VerticalStepContentComponent } from "./vertical-step-content.component";
import { VerticalStep } from "./vertical-step.component";
import { VerticalStepperComponent } from "./vertical-stepper.component";

@NgModule({
  imports: [SharedModule],
  declarations: [VerticalStepperComponent, VerticalStep, VerticalStepContentComponent],
  exports: [VerticalStepperComponent, VerticalStep],
})
export class VerticalStepperModule {}
