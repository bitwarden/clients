import { CdkStep } from "@angular/cdk/stepper";
import { Component, Input } from "@angular/core";

@Component({
  selector: "app-vertical-step",
  templateUrl: "vertical-step.component.html",
  providers: [{ provide: CdkStep, useExisting: VerticalStep }],
  standalone: false,
})
export class VerticalStep extends CdkStep {
  @Input() subLabel = "";
  @Input() applyBorder = true;
  @Input() addSubLabelSpacing = false;
}
