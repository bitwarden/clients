import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";

import { I18nPipe } from "@bitwarden/ui-common";

/**
 * Module providing commonly used imports and exports for other component modules.
 */
@NgModule({
  imports: [CommonModule, I18nPipe],
  exports: [CommonModule, I18nPipe],
})
export class SharedModule {}
