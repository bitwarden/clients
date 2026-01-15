import { NgModule } from "@angular/core";

import { LinkComponent } from "./link.component";
import { ButtonLinkDirective } from "./link.directive";

@NgModule({
  imports: [LinkComponent, ButtonLinkDirective],
  exports: [LinkComponent, ButtonLinkDirective],
})
export class LinkModule {}
