import { NgModule } from "@angular/core";

import { BitInputDirective } from "./input.directive";

@NgModule({
  imports: [BitInputDirective],
  exports: [BitInputDirective],
})
export class InputModule {}
