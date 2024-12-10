// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Component, EventEmitter, Input, Output } from "@angular/core";

import { VerticalStep } from "./vertical-step.component";

@Component({
  selector: "app-vertical-step-content",
  templateUrl: "vertical-step-content.component.html",
})
export class VerticalStepContentComponent {
  @Output() onSelectStep = new EventEmitter<void>();

  @Input() disabled = false;
  @Input() selected = false;
  @Input() step: VerticalStep;
  @Input() stepNumber: number;

  selectStep() {
    this.onSelectStep.emit();
  }
}
