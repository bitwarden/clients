import { NgModule } from "@angular/core";

import { SharedModule } from "../shared";

import { I18nPartDirective } from "./i18n-part.directive";
import { I18nComponent } from "./i18n.component";

@NgModule({
  imports: [SharedModule, I18nComponent, I18nPartDirective],
  exports: [I18nComponent, I18nPartDirective],
})
export class I18nModule {}
