import { NgModule } from "@angular/core";

import { AvatarComponent } from "./avatar.component";

/**
 * Module providing the avatar component for displaying user account identifiers.
 */
@NgModule({
  imports: [AvatarComponent],
  exports: [AvatarComponent],
})
export class AvatarModule {}
