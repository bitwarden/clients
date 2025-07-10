import { NgModule } from "@angular/core";

import { FormControlComponent } from "./form-control.component";
import { BitHintComponent } from "./hint.component";
import { BitLabel } from "./label.component";

@NgModule({
  imports: [BitLabel, FormControlComponent, BitHintComponent],
  exports: [FormControlComponent, BitLabel, BitHintComponent],
})
export class FormControlModule {}
