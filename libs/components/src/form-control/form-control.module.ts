import { NgModule } from "@angular/core";

import { SharedModule } from "../shared";

import { FormControlComponent } from "./form-control.component";
import { BitHintComponent } from "./hint.component";
import { BitLabel } from "./label.component";

@NgModule({
  imports: [SharedModule, BitLabel],
  declarations: [FormControlComponent, BitHintComponent],
  exports: [FormControlComponent, BitLabel, BitHintComponent],
})
export class FormControlModule {}
