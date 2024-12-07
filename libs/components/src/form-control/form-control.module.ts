import { NgModule } from "@angular/core";

import { SharedModule } from "../shared";
import { TypographyModule } from "../typography";

import { FormControlComponent } from "./form-control.component";
import { BitHintComponent } from "./hint.component";
import { BitLabel } from "./label.component";

@NgModule({
  imports: [SharedModule, BitLabel, TypographyModule],
  declarations: [FormControlComponent, BitHintComponent],
  exports: [FormControlComponent, BitLabel, BitHintComponent],
})
export class FormControlModule {}
