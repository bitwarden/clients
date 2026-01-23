import { NgModule } from "@angular/core";

import { OptionComponent } from "./option.component";
import { SelectComponent } from "./select.component";

/**
 * Module providing select components for dropdown selections.
 */
@NgModule({
  imports: [SelectComponent, OptionComponent],
  exports: [SelectComponent, OptionComponent],
})
export class SelectModule {}
