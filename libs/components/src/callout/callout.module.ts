import { NgModule } from "@angular/core";

import { CalloutComponent } from "./callout.component";

/**
 * Module providing the callout component for important user communications.
 */
@NgModule({
  imports: [CalloutComponent],
  exports: [CalloutComponent],
})
export class CalloutModule {}
