import { NgModule } from "@angular/core";

import { FormControlModule } from "../form-control";

import { RadioButtonComponent } from "./radio-button.component";
import { RadioGroupComponent } from "./radio-group.component";
import { RadioInputComponent } from "./radio-input.component";

@NgModule({
  imports: [FormControlModule, RadioInputComponent, RadioButtonComponent, RadioGroupComponent],
  exports: [FormControlModule, RadioInputComponent, RadioButtonComponent, RadioGroupComponent],
})
export class RadioButtonModule {}
