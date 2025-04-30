import { CdkStep } from "@angular/cdk/stepper";
import { CommonModule } from "@angular/common";
import { Component, input } from "@angular/core";

@Component({
  selector: "bit-vertical-step",
  templateUrl: "vertical-step.component.html",
  providers: [{ provide: CdkStep, useExisting: VerticalStep }],
  standalone: true,
  imports: [CommonModule],
})
export class VerticalStep extends CdkStep {
  subLabel = input();
  applyBorder = input<boolean>(true);
}
