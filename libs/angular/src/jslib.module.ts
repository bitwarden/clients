import { CommonModule, DatePipe } from "@angular/common";
import { NgModule } from "@angular/core";
import { FormsModule, ReactiveFormsModule } from "@angular/forms";

import { CalloutComponent } from "./components/callout.component";
import { CaptchaComponent } from "./components/captcha.component";
import { ExportScopeCalloutComponent } from "./components/export-scope-callout.component";
import { IconComponent } from "./components/icon.component";
import { BitwardenToastModule } from "./components/toastr.component";
import { A11yInvalidDirective } from "./directives/a11y-invalid.directive";
import { A11yTitleDirective } from "./directives/a11y-title.directive";
import { ApiActionDirective } from "./directives/api-action.directive";
import { AutofocusDirective } from "./directives/autofocus.directive";
import { BoxRowDirective } from "./directives/box-row.directive";
import { CopyClickDirective } from "./directives/copy-click.directive";
import { FallbackSrcDirective } from "./directives/fallback-src.directive";
import { InputStripSpacesDirective } from "./directives/input-strip-spaces.directive";
import { InputVerbatimDirective } from "./directives/input-verbatim.directive";
import { LaunchClickDirective } from "./directives/launch-click.directive";
import { NotPremiumDirective } from "./directives/not-premium.directive";
import { SelectCopyDirective } from "./directives/select-copy.directive";
import { StopClickDirective } from "./directives/stop-click.directive";
import { StopPropDirective } from "./directives/stop-prop.directive";
import { TrueFalseValueDirective } from "./directives/true-false-value.directive";
import { ColorPasswordCountPipe } from "./pipes/color-password-count.pipe";
import { ColorPasswordPipe } from "./pipes/color-password.pipe";
import { CreditCardNumberPipe } from "./pipes/credit-card-number.pipe";
import { EllipsisPipe } from "./pipes/ellipsis.pipe";
import { I18nPipe } from "./pipes/i18n.pipe";
import { SearchCiphersPipe } from "./pipes/search-ciphers.pipe";
import { SearchPipe } from "./pipes/search.pipe";
import { UserNamePipe } from "./pipes/user-name.pipe";
import { PasswordStrengthComponent } from "./shared/components/password-strength/password-strength.component";

@NgModule({
  imports: [
    BitwardenToastModule.forRoot({
      maxOpened: 5,
      autoDismiss: true,
      closeButton: true,
    }),
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
  ],
  declarations: [
    A11yInvalidDirective,
    A11yTitleDirective,
    ApiActionDirective,
    AutofocusDirective,
    BoxRowDirective,
    CalloutComponent,
    CaptchaComponent,
    ColorPasswordCountPipe,
    ColorPasswordPipe,
    CreditCardNumberPipe,
    EllipsisPipe,
    ExportScopeCalloutComponent,
    FallbackSrcDirective,
    I18nPipe,
    IconComponent,
    InputStripSpacesDirective,
    InputVerbatimDirective,
    NotPremiumDirective,
    PasswordStrengthComponent,
    SearchCiphersPipe,
    SearchPipe,
    SelectCopyDirective,
    StopClickDirective,
    StopPropDirective,
    TrueFalseValueDirective,
    CopyClickDirective,
    LaunchClickDirective,
    UserNamePipe,
  ],
  exports: [
    A11yInvalidDirective,
    A11yTitleDirective,
    ApiActionDirective,
    AutofocusDirective,
    BitwardenToastModule,
    BoxRowDirective,
    CalloutComponent,
    CaptchaComponent,
    ColorPasswordCountPipe,
    ColorPasswordPipe,
    CreditCardNumberPipe,
    EllipsisPipe,
    ExportScopeCalloutComponent,
    FallbackSrcDirective,
    I18nPipe,
    IconComponent,
    InputStripSpacesDirective,
    InputVerbatimDirective,
    NotPremiumDirective,
    PasswordStrengthComponent,
    SearchCiphersPipe,
    SearchPipe,
    SelectCopyDirective,
    StopClickDirective,
    StopPropDirective,
    TrueFalseValueDirective,
    CopyClickDirective,
    LaunchClickDirective,
    UserNamePipe,
  ],
  providers: [CreditCardNumberPipe, DatePipe, I18nPipe, SearchPipe, UserNamePipe],
})
export class JslibModule {}
