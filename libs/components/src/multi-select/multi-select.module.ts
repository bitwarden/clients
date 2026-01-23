import { NgModule } from "@angular/core";

import { MultiSelectComponent } from "./multi-select.component";

/**
 * Module providing the multi-select component for selecting multiple options.
 */
@NgModule({
  imports: [MultiSelectComponent],
  exports: [MultiSelectComponent],
})
export class MultiSelectModule {}
