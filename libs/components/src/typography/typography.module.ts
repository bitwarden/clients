import { NgModule } from "@angular/core";

import { TypographyDirective } from "./typography.directive";

@NgModule({
  imports: [TypographyDirective],
  exports: [TypographyDirective],
})
export class TypographyModule {}
