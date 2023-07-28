import { CommonModule, DatePipe } from "@angular/common";
import { NgModule } from "@angular/core";
import { FormsModule, ReactiveFormsModule } from "@angular/forms";

import { CalloutComponent } from "./components/callout.component";
import { BitwardenToastModule } from "./components/toastr.component";
import { A11yInvalidDirective } from "./directives/a11y-invalid.directive";
import { A11yTitleDirective } from "./directives/a11y-title.directive";
import { ApiActionDirective } from "./directives/api-action.directive";
import { AutofocusDirective } from "./directives/autofocus.directive";
import { BoxRowDirective } from "./directives/box-row.directive";
import { CopyClickDirective } from "./directives/copy-click.directive";
import { CopyTextDirective } from "./directives/copy-text.directive";
import { FallbackSrcDirective } from "./directives/fallback-src.directive";
import { IfFeatureDirective } from "./directives/if-feature.directive";
import { InputStripSpacesDirective } from "./directives/input-strip-spaces.directive";
import { InputVerbatimDirective } from "./directives/input-verbatim.directive";
import { LaunchClickDirective } from "./directives/launch-click.directive";
import { NotPremiumDirective } from "./directives/not-premium.directive";
import { StopClickDirective } from "./directives/stop-click.directive";
import { StopPropDirective } from "./directives/stop-prop.directive";
import { TrueFalseValueDirective } from "./directives/true-false-value.directive";
import { CreditCardNumberPipe } from "./pipes/credit-card-number.pipe";
import { SearchCiphersPipe } from "./pipes/search-ciphers.pipe";
import { SearchPipe } from "./pipes/search.pipe";
import { UserNamePipe } from "./pipes/user-name.pipe";
import { UserTypePipe } from "./pipes/user-type.pipe";
import { EllipsisPipe } from "./platform/pipes/ellipsis.pipe";
import { FingerprintPipe } from "./platform/pipes/fingerprint.pipe";
import { I18nPipe } from "./platform/pipes/i18n.pipe";
import { PasswordStrengthComponent } from "./shared/components/password-strength/password-strength.component";
import { ExportScopeCalloutComponent } from "./tools/export/components/export-scope-callout.component";
import { IconComponent } from "./vault/components/icon.component";

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
    CopyTextDirective,
    CreditCardNumberPipe,
    EllipsisPipe,
    ExportScopeCalloutComponent,
    FallbackSrcDirective,
    I18nPipe,
    IconComponent,
    InputStripSpacesDirective,
    InputVerbatimDirective,
    NotPremiumDirective,
    SearchCiphersPipe,
    SearchPipe,
    StopClickDirective,
    StopPropDirective,
    TrueFalseValueDirective,
    CopyClickDirective,
    LaunchClickDirective,
    UserNamePipe,
    PasswordStrengthComponent,
    UserTypePipe,
    IfFeatureDirective,
    FingerprintPipe,
  ],
  exports: [
    A11yInvalidDirective,
    A11yTitleDirective,
    ApiActionDirective,
    AutofocusDirective,
    BitwardenToastModule,
    BoxRowDirective,
    CalloutComponent,
    CopyTextDirective,
    CreditCardNumberPipe,
    EllipsisPipe,
    ExportScopeCalloutComponent,
    FallbackSrcDirective,
    I18nPipe,
    IconComponent,
    InputStripSpacesDirective,
    InputVerbatimDirective,
    NotPremiumDirective,
    SearchCiphersPipe,
    SearchPipe,
    StopClickDirective,
    StopPropDirective,
    TrueFalseValueDirective,
    CopyClickDirective,
    LaunchClickDirective,
    UserNamePipe,
    PasswordStrengthComponent,
    UserTypePipe,
    IfFeatureDirective,
    FingerprintPipe,
  ],
  providers: [
    CreditCardNumberPipe,
    DatePipe,
    I18nPipe,
    SearchPipe,
    UserNamePipe,
    UserTypePipe,
    FingerprintPipe,
  ],
})
export class JslibModule {}
