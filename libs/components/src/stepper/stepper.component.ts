import { CdkStepper } from "@angular/cdk/stepper";
import { CommonModule } from "@angular/common";
import { Component } from "@angular/core";

import { ResizeObserverDirective } from "../resize-observer/resize-observer.directive";

import { StepContentComponent } from "./step-content.component";

@Component({
  selector: "bit-stepper",
  templateUrl: "stepper.component.html",
  providers: [{ provide: CdkStepper, useExisting: StepperComponent }],
  imports: [CommonModule, ResizeObserverDirective, StepContentComponent],
  standalone: true,
})
export class StepperComponent extends CdkStepper {
  resizeWidthsMap = new Map([
    [2, 600],
    [3, 768],
    [4, 900],
  ]);

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

  private initialOrientation = this.orientation;

  handleResize(entry: ResizeObserverEntry) {
    const width = entry.contentRect.width;
    const numberOfSteps = this.steps.length;

    if (this.initialOrientation === "horizontal") {
      this.orientation =
        width < this.resizeWidthsMap.get(numberOfSteps) ? "vertical" : "horizontal";
      // This is a method of CdkStepper. Their docs define it as: 'Marks the component to be change detected'
      this._stateChanged();
    }
  }

  /**
   * UID for `[attr.aria-controls]`
   */
  protected contentId = Math.random().toString(36).substring(2);
}
