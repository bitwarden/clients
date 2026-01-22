import { NgModule } from "@angular/core";

import { BitActionDirective } from "./bit-action.directive";
import { BitSubmitDirective } from "./bit-submit.directive";
import { BitFormButtonDirective } from "./form-button.directive";

/**
 * Module providing directives for handling async actions and form submissions.
 */
@NgModule({
  imports: [BitActionDirective, BitFormButtonDirective, BitSubmitDirective],
  exports: [BitActionDirective, BitFormButtonDirective, BitSubmitDirective],
})
export class AsyncActionsModule {}
