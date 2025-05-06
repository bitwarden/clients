import { CdkStep } from "@angular/cdk/stepper";
import { CommonModule } from "@angular/common";
import { Component, input } from "@angular/core";

@Component({
  selector: "bit-step",
  templateUrl: "step.component.html",
  providers: [{ provide: CdkStep, useExisting: StepComponent }],
  standalone: true,
  imports: [CommonModule],
})
export class StepComponent extends CdkStep {
  subLabel = input();
  applyBorder = input<boolean>(true);
}
