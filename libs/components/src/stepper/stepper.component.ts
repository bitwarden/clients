import { CdkStepper, StepperOrientation } from "@angular/cdk/stepper";
import { CommonModule } from "@angular/common";
import { Component, Input, QueryList } from "@angular/core";

import { ResizeObserverDirective } from "../resize-observer";

import { StepComponent } from "./step.component";

@Component({
  selector: "bit-stepper",
  templateUrl: "stepper.component.html",
  providers: [{ provide: CdkStepper, useExisting: StepperComponent }],
  imports: [CommonModule, ResizeObserverDirective],
  standalone: true,
})
export class StepperComponent extends CdkStepper {
  private resizeWidthsMap = new Map([
    [2, 600],
    [3, 768],
    [4, 900],
  ]);

  override readonly steps!: QueryList<StepComponent>;

  private internalOrientation: StepperOrientation | undefined = undefined;
  private initialOrientation: StepperOrientation | undefined = undefined;

  // overriding CdkStepper orientation input so we can default to vertical
  @Input()
  override get orientation() {
    return this.internalOrientation || "vertical";
  }
  override set orientation(value: StepperOrientation) {
    if (!this.internalOrientation) {
      // tracking the first value of orientation. We want to handle resize events if it's 'horizontal'.
      // If it's 'vertical' don't change the orientation to 'horizontal' when resizing
      this.initialOrientation = value;
    }

    this.internalOrientation = value;
  }

  handleResize(entry: ResizeObserverEntry) {
    if (this.initialOrientation === "horizontal") {
      const stepperContainerWidth = entry.contentRect.width;
      const numberOfSteps = this.steps.length;
      const breakpoint = this.resizeWidthsMap.get(numberOfSteps) || 450;

      this.orientation = stepperContainerWidth < breakpoint ? "vertical" : "horizontal";
      // This is a method of CdkStepper. Their docs define it as: 'Marks the component to be change detected'
      this._stateChanged();
    }
  }

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
