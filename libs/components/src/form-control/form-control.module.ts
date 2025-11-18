import { NgModule } from "@angular/core";

import { FormControlComponent } from "./form-control.component";
import { BitHintComponent } from "./hint.component";
import { BitLabelComponent } from "./label.component";

@NgModule({
  imports: [BitLabelComponent, FormControlComponent, BitHintComponent],
  exports: [FormControlComponent, BitLabelComponent, BitHintComponent],
})
export class FormControlModule {}
