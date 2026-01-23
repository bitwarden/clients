import { NgModule } from "@angular/core";

import { CheckboxComponent } from "./checkbox.component";

/**
 * Module providing the checkbox component for binary selection inputs.
 */
@NgModule({
  imports: [CheckboxComponent],
  exports: [CheckboxComponent],
})
export class CheckboxModule {}
