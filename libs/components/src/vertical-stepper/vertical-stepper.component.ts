import { CdkStepper } from "@angular/cdk/stepper";
import { CommonModule } from "@angular/common";
import { Component, QueryList } from "@angular/core";

import { VerticalStepContentComponent } from "./vertical-step-content.component";
import { VerticalStep } from "./vertical-step.component";

@Component({
  selector: "bit-vertical-stepper",
  templateUrl: "vertical-stepper.component.html",
  providers: [{ provide: CdkStepper, useExisting: VerticalStepperComponent }],
  imports: [CommonModule, VerticalStepContentComponent],
  standalone: true,
})
export class VerticalStepperComponent extends CdkStepper {
  override readonly steps: QueryList<VerticalStep>;

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
