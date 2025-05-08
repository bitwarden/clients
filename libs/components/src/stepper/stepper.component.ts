import { CdkStepper } from "@angular/cdk/stepper";
import { CommonModule } from "@angular/common";
import { Component } from "@angular/core";

import { StepContentComponent } from "./step-content.component";

@Component({
  selector: "bit-stepper",
  templateUrl: "stepper.component.html",
  providers: [{ provide: CdkStepper, useExisting: StepperComponent }],
  imports: [CommonModule, StepContentComponent],
  standalone: true,
})
export class StepperComponent extends CdkStepper {
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

  /**
   * UID for `[attr.aria-controls]`
   */
  protected contentId = Math.random().toString(36).substring(2);
}
