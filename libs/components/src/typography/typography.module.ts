import { NgModule } from "@angular/core";

import { TypographyDirective } from "./typography.directive";

/**
 * Module providing typography directive for text styling.
 */
@NgModule({
  imports: [TypographyDirective],
  exports: [TypographyDirective],
})
export class TypographyModule {}
