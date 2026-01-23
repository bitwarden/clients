import { NgModule } from "@angular/core";

import { BitIconButtonComponent } from "./icon-button.component";

/**
 * Module providing the icon button component for icon-only interactive buttons.
 */
@NgModule({
  imports: [BitIconButtonComponent],
  exports: [BitIconButtonComponent],
})
export class IconButtonModule {}
