import { NgModule } from "@angular/core";

import { FormControlComponent } from "./form-control.component";
import { BitHintDirective } from "./hint.directive";
import { BitLabel } from "./label.component";

@NgModule({
  imports: [BitLabel, FormControlComponent, BitHintDirective],
  exports: [FormControlComponent, BitLabel, BitHintDirective],
})
export class FormControlModule {}
