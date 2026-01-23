import { NgModule } from "@angular/core";

import { AnchorLinkDirective, ButtonLinkDirective } from "./link.directive";

/**
 * Module providing link directives for styled anchors and button links.
 */
@NgModule({
  imports: [AnchorLinkDirective, ButtonLinkDirective],
  exports: [AnchorLinkDirective, ButtonLinkDirective],
})
export class LinkModule {}
