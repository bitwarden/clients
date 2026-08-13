import { NgModule } from "@angular/core";

import { FormControlModule } from "../form-control";
import { InputModule } from "../input/input.module";
import { MultiSelectModule } from "../multi-select/multi-select.module";

import { BitCustomInputDirective } from "./custom-input.directive";
import { BitErrorSummaryComponent } from "./error-summary.component";
import { BitErrorComponent } from "./error.component";
import { BitFormFieldComponent } from "./form-field.component";
import { BitPasswordInputToggleDirective } from "./password-input-toggle.directive";
import { BitPrefixDirective } from "./prefix.directive";
import { BitSuffixDirective } from "./suffix.directive";

@NgModule({
  imports: [
    FormControlModule,
    InputModule,
    MultiSelectModule,

    BitCustomInputDirective,
    BitErrorComponent,
    BitErrorSummaryComponent,
    BitFormFieldComponent,
    BitPasswordInputToggleDirective,
    BitPrefixDirective,
    BitSuffixDirective,
  ],
  exports: [
    FormControlModule,
    InputModule,
    MultiSelectModule,

    BitCustomInputDirective,
    BitErrorComponent,
    BitErrorSummaryComponent,
    BitFormFieldComponent,
    BitPasswordInputToggleDirective,
    BitPrefixDirective,
    BitSuffixDirective,
  ],
})
export class FormFieldModule {}
