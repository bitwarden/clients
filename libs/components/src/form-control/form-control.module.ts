import { NgModule } from "@angular/core";

import { FormControlComponent } from "./form-control.component";
import { BitHintDirective } from "./hint.directive";
import { BitLabelComponent } from "./label.component";

@NgModule({
  imports: [BitLabelComponent, FormControlComponent, BitHintDirective],
  exports: [FormControlComponent, BitLabelComponent, BitHintDirective],
})
export class FormControlModule {}
