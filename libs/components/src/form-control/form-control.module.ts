import { NgModule } from "@angular/core";

import { FormControlCardComponent } from "./form-control-card.component";
import { FormControlGroupComponent } from "./form-control-group.component";
import { FormControlComponent } from "./form-control.component";
import { BitHintDirective } from "./hint.directive";
import { BitLabelComponent } from "./label.component";

@NgModule({
  imports: [
    BitLabelComponent,
    FormControlComponent,
    BitHintDirective,
    FormControlCardComponent,
    FormControlGroupComponent,
  ],
  exports: [
    FormControlComponent,
    BitLabelComponent,
    BitHintDirective,
    FormControlCardComponent,
    FormControlGroupComponent,
  ],
})
export class FormControlModule {}
