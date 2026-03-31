import { NgModule } from "@angular/core";

import { FormControlModule } from "../form-control";
import { FormControlCardComponent } from "../form-control/form-control-card.component";
import { FormControlGroupComponent } from "../form-control/form-control-group.component";

import { RadioButtonCardComponent } from "./radio-button-card.component";
import { RadioButtonComponent } from "./radio-button.component";
import { RadioInputComponent } from "./radio-input.component";

@NgModule({
  imports: [
    FormControlModule,
    FormControlCardComponent,
    FormControlGroupComponent,
    RadioInputComponent,
    RadioButtonComponent,
    RadioButtonCardComponent,
  ],
  exports: [
    FormControlModule,
    FormControlCardComponent,
    FormControlGroupComponent,
    RadioInputComponent,
    RadioButtonComponent,
    RadioButtonCardComponent,
  ],
})
export class RadioButtonModule {}
