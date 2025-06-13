import { CdkStep, CdkStepper } from "@angular/cdk/stepper";
import { Component, input } from "@angular/core";

@Component({
  selector: "bit-step",
  templateUrl: "step.component.html",
  providers: [{ provide: CdkStep, useExisting: StepComponent }],
  standalone: true,
})
export class StepComponent extends CdkStep {
  subLabel = input();

  constructor(stepper: CdkStepper) {
    super(stepper);
  }
}
