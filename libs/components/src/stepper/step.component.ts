import { CdkStep, CdkStepper } from "@angular/cdk/stepper";
import { ChangeDetectionStrategy, Component, input } from "@angular/core";

@Component({
  selector: "bit-step",
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: "step.component.html",
  providers: [{ provide: CdkStep, useExisting: StepComponent }],
})
export class StepComponent extends CdkStep {
  readonly subLabel = input();

  constructor(stepper: CdkStepper) {
    super(stepper);
  }
}
