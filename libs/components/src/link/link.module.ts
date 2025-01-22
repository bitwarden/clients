import { NgModule } from "@angular/core";

import { AnchorLinkDirective, ButtonLinkDirective } from "./link.directive";

@NgModule({
  imports: [AnchorLinkDirective, ButtonLinkDirective],
  exports: [AnchorLinkDirective, ButtonLinkDirective],
})
export class LinkModule {}
