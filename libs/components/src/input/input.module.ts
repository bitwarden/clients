import { NgModule } from "@angular/core";

import { BitInputDirective } from "./input.directive";

/**
 * Module providing input directive for styled form inputs.
 */
@NgModule({
  imports: [BitInputDirective],
  exports: [BitInputDirective],
})
export class InputModule {}
