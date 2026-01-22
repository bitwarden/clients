import { NgModule } from "@angular/core";

import { ButtonComponent } from "./button.component";

/**
 * Module providing the button component for user interactions.
 */
@NgModule({
  imports: [ButtonComponent],
  exports: [ButtonComponent],
})
export class ButtonModule {}
