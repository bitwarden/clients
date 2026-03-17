import { NgTemplateOutlet } from "@angular/common";
import { ChangeDetectionStrategy, Component, contentChild } from "@angular/core";

import { BitLabelComponent } from "./label.component";

let nextId = 0;

@Component({
  selector: "bit-form-control-card-group",
  templateUrl: "form-control-card-group.component.html",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet],
})
export class FormControlCardGroupComponent {
  readonly id = `bit-form-control-card-group-${nextId++}`;

  protected readonly label = contentChild(BitLabelComponent);
}
