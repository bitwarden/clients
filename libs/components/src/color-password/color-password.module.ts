import { NgModule } from "@angular/core";

import { ColorPasswordComponent } from "./color-password.component";

/**
 * Module providing the color password component for displaying passwords with colored characters.
 */
@NgModule({
  imports: [ColorPasswordComponent],
  exports: [ColorPasswordComponent],
})
export class ColorPasswordModule {}
