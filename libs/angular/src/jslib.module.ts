import { CommonModule, DatePipe } from "@angular/common";
import { NgModule } from "@angular/core";
import { FormsModule, ReactiveFormsModule } from "@angular/forms";

import {
  InvoicesComponent,
  NoInvoicesComponent,
  ManageTaxInformationComponent,
} from "@bitwarden/angular/billing/components";
import {
  AsyncActionsModule,
  AutofocusDirective,
  ButtonModule,
  CalloutModule,
  CheckboxModule,
  DialogModule,
  FormFieldModule,
  IconButtonModule,
  IconModule,
  LinkModule,
  MenuModule,
  RadioButtonModule,
  SelectModule,
  TableModule,
  ToastModule,
  TypographyModule,
  CopyClickDirective,
  A11yTitleDirective,
} from "@bitwarden/components";

import { TwoFactorIconComponent } from "./auth/components/two-factor-icon.component";
import { NotPremiumDirective } from "./billing/directives/not-premium.directive";
import { DeprecatedCalloutComponent } from "./components/callout.component";
import { A11yInvalidDirective } from "./directives/a11y-invalid.directive";
import { ApiActionDirective } from "./directives/api-action.directive";
import { BoxRowDirective } from "./directives/box-row.directive";
import { CopyTextDirective } from "./directives/copy-text.directive";
import { FallbackSrcDirective } from "./directives/fallback-src.directive";
import { IfFeatureDirective } from "./directives/if-feature.directive";
import { InputStripSpacesDirective } from "./directives/input-strip-spaces.directive";
import { InputVerbatimDirective } from "./directives/input-verbatim.directive";
import { LaunchClickDirective } from "./directives/launch-click.directive";
import { StopClickDirective } from "./directives/stop-click.directive";
import { StopPropDirective } from "./directives/stop-prop.directive";
import { TextDragDirective } from "./directives/text-drag.directive";
import { TrueFalseValueDirective } from "./directives/true-false-value.directive";
import { CreditCardNumberPipe } from "./pipes/credit-card-number.pipe";
import { PluralizePipe } from "./pipes/pluralize.pipe";
import { SearchCiphersPipe } from "./pipes/search-ciphers.pipe";
import { SearchPipe } from "./pipes/search.pipe";
import { UserNamePipe } from "./pipes/user-name.pipe";
import { UserTypePipe } from "./pipes/user-type.pipe";
import { EllipsisPipe } from "./platform/pipes/ellipsis.pipe";
import { FingerprintPipe } from "./platform/pipes/fingerprint.pipe";
import { I18nPipe } from "./platform/pipes/i18n.pipe";
import { IconComponent } from "./vault/components/icon.component";

@NgModule({
  imports: [
    ToastModule.forRoot({
      maxOpened: 5,
      autoDismiss: true,
      closeButton: true,
    }),
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    AsyncActionsModule,
    RadioButtonModule,
    FormFieldModule,
    SelectModule,
    ButtonModule,
    CalloutModule,
    CheckboxModule,
    DialogModule,
    TypographyModule,
    TableModule,
    MenuModule,
    IconButtonModule,
    IconModule,
    LinkModule,
    IconModule,
    TextDragDirective,
    CopyClickDirective,
    A11yTitleDirective,
    AutofocusDirective,
  ],
  declarations: [
    A11yInvalidDirective,
    ApiActionDirective,
    BoxRowDirective,
    DeprecatedCalloutComponent,
    CopyTextDirective,
    CreditCardNumberPipe,
    EllipsisPipe,
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
    LaunchClickDirective,
    UserNamePipe,
    UserTypePipe,
    IfFeatureDirective,
    FingerprintPipe,
    InvoicesComponent,
    NoInvoicesComponent,
    ManageTaxInformationComponent,
    TwoFactorIconComponent,
  ],
  exports: [
    A11yInvalidDirective,
    A11yTitleDirective,
    ApiActionDirective,
    AutofocusDirective,
    ToastModule,
    BoxRowDirective,
    DeprecatedCalloutComponent,
    CopyTextDirective,
    CreditCardNumberPipe,
    EllipsisPipe,
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
    UserTypePipe,
    IfFeatureDirective,
    FingerprintPipe,
    InvoicesComponent,
    NoInvoicesComponent,
    ManageTaxInformationComponent,
    TwoFactorIconComponent,
    TextDragDirective,
  ],
  providers: [
    CreditCardNumberPipe,
    DatePipe,
    I18nPipe,
    SearchPipe,
    UserNamePipe,
    UserTypePipe,
    FingerprintPipe,
    PluralizePipe,
  ],
})
export class JslibModule {}
