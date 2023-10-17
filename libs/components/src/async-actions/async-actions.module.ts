import { NgModule } from "@angular/core";

import { SharedModule } from "../shared";

import { BitActionDirective } from "./bit-action.directive";
import { BitAsyncClickDirective } from "./bit-async-click.directive";
import { BitAsyncDisableDirective } from "./bit-async-disable.directive";
import { BitSubmitDirective } from "./bit-submit.directive";
import { BitFormButtonDirective } from "./form-button.directive";

@NgModule({
  imports: [SharedModule],
  declarations: [
    BitActionDirective,
    BitFormButtonDirective,
    BitSubmitDirective,
    BitAsyncClickDirective,
    BitAsyncDisableDirective,
  ],
  exports: [
    BitActionDirective,
    BitFormButtonDirective,
    BitSubmitDirective,
    BitAsyncClickDirective,
    BitAsyncDisableDirective,
  ],
})
export class AsyncActionsModule {}
