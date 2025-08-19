import { Directionality } from "@angular/cdk/bidi";
import { CdkStepper, StepperOrientation } from "@angular/cdk/stepper";
import { CommonModule } from "@angular/common";
import { ChangeDetectorRef, Component, ElementRef, Input, QueryList } from "@angular/core";

import { ResizeObserverDirective } from "../resize-observer";
import { TypographyModule } from "../typography";

import { StepComponent } from "./step.component";

/**
 * The `<bit-stepper>` component extends the
 * [Angular CdkStepper](https://material.angular.io/cdk/stepper/api#CdkStepper) component
 */
@Component({
  selector: "bit-stepper",
  templateUrl: "stepper.component.html",
  providers: [{ provide: CdkStepper, useExisting: StepperComponent }],
  imports: [CommonModule, ResizeObserverDirective, TypographyModule],
  standalone: true,
})
export class StepperComponent extends CdkStepper {
  // Need to reimplement the constructor to fix an invalidFactoryDep error in Storybook
  // @see https://github.com/storybookjs/storybook/issues/23534#issuecomment-2042888436
  constructor(
    _dir: Directionality,
    _changeDetectorRef: ChangeDetectorRef,
    _elementRef: ElementRef<HTMLElement>,
  ) {
    super(_dir, _changeDetectorRef, _elementRef);
  }

  private resizeWidthsMap = new Map([
    [2, 600],
    [3, 768],
    [4, 900],
  ]);

  override readonly steps!: QueryList<StepComponent>;

  private internalOrientation: StepperOrientation | undefined = undefined;
  private initialOrientation: StepperOrientation | undefined = undefined;

  // overriding CdkStepper orientation input so we can default to vertical
  // TODO: Skipped for signal migration because:
  //  Accessor inputs cannot be migrated as they are too complex.
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
