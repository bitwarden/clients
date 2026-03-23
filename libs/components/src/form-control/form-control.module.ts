import { NgModule } from "@angular/core";

import { FormControlCardGroupComponent } from "./form-control-card-group.component";
import { FormControlCardComponent } from "./form-control-card.component";
import { FormControlComponent } from "./form-control.component";
import { BitHintDirective } from "./hint.directive";
import { BitLabelComponent } from "./label.component";

@NgModule({
  imports: [
    BitLabelComponent,
    FormControlComponent,
    BitHintDirective,
    FormControlCardComponent,
    FormControlCardGroupComponent,
  ],
  exports: [
    FormControlComponent,
    BitLabelComponent,
    BitHintDirective,
    FormControlCardComponent,
    FormControlCardGroupComponent,
  ],
})
export class FormControlModule {}
