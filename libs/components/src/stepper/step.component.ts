import { CdkStep, CdkStepper } from "@angular/cdk/stepper";
import { Component, input } from "@angular/core";

// FIXME(https://bitwarden.atlassian.net/browse/CL-764): Migrate to OnPush
// eslint-disable-next-line @angular-eslint/prefer-on-push-component-change-detection
@Component({
  selector: "bit-step",
  templateUrl: "step.component.html",
  providers: [{ provide: CdkStep, useExisting: StepComponent }],
  standalone: true,
})
export class StepComponent extends CdkStep {
  readonly subLabel = input();

  constructor(stepper: CdkStepper) {
    super(stepper);
  }
}
