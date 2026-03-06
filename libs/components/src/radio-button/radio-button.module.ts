import { NgModule } from "@angular/core";

import { FormControlModule } from "../form-control";
import { FormControlCardComponent } from "../form-control/form-control-card.component";

import { RadioButtonCardComponent } from "./radio-button-card.component";
import { RadioButtonComponent } from "./radio-button.component";
import { RadioGroupComponent } from "./radio-group.component";
import { RadioInputComponent } from "./radio-input.component";

@NgModule({
  imports: [
    FormControlModule,
    FormControlCardComponent,
    RadioInputComponent,
    RadioButtonComponent,
    RadioButtonCardComponent,
    RadioGroupComponent,
  ],
  exports: [
    FormControlModule,
    FormControlCardComponent,
    RadioInputComponent,
    RadioButtonComponent,
    RadioButtonCardComponent,
    RadioGroupComponent,
  ],
})
export class RadioButtonModule {}
