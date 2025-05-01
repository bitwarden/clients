import { NgModule } from "@angular/core";

import { OptionComponent } from "./option.component";
import { SelectComponent } from "./select.component";

@NgModule({
  imports: [SelectComponent, OptionComponent],
  exports: [SelectComponent, OptionComponent],
})
export class SelectModule {}
