import { NgModule } from "@angular/core";

import { BitIconComponent } from "./icon.component";

/**
 * Module providing the icon component for displaying SVG icons.
 */
@NgModule({
  imports: [BitIconComponent],
  exports: [BitIconComponent],
})
export class IconModule {}
