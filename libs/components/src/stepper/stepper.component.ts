import { CdkStepper } from "@angular/cdk/stepper";
import { CommonModule } from "@angular/common";
import { Component, QueryList } from "@angular/core";

import { StepContentComponent } from "./step-content.component";
import { StepComponent } from "./step.component";

@Component({
  selector: "bit-stepper",
  templateUrl: "stepper.component.html",
  providers: [{ provide: CdkStepper, useExisting: StepperComponent }],
  imports: [CommonModule, StepContentComponent],
  standalone: true,
})
export class StepperComponent extends CdkStepper {
  override readonly steps: QueryList<StepComponent>;

  isStepDisabled(index: number) {
    if (this.selectedIndex !== index) {
      return this.selectedIndex === index - 1
        ? !this.steps.find((_, i) => i == index - 1)?.completed
        : true;
    }
    return false;
  }

  selectStepByIndex(index: number): void {
    this.selectedIndex = index;
  }
}
