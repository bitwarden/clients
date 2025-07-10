import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";

import { I18nPipe } from "@bitwarden/ui-common";

@NgModule({
  imports: [CommonModule, I18nPipe],
  exports: [CommonModule, I18nPipe],
})
export class SharedModule {}
