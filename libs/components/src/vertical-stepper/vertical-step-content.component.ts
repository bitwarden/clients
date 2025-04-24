// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { CommonModule } from "@angular/common";
import { Component, EventEmitter, Input, Output } from "@angular/core";

import { VerticalStep } from "./vertical-step.component";

@Component({
  selector: "bit-vertical-step-content",
  templateUrl: "vertical-step-content.component.html",
  standalone: true,
  imports: [CommonModule],
})
export class VerticalStepContentComponent {
  @Output() onSelectStep = new EventEmitter<void>();

  @Input() disabled = false;
  @Input() selected = false;
  @Input() step: VerticalStep;
  @Input() stepNumber: number;

  /**
   * UID for `[attr.aria-controls]`
   */
  protected contentId = Math.random().toString(36).substring(2);

  selectStep() {
    this.onSelectStep.emit();
  }
}
