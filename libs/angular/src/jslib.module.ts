import { CommonModule, DatePipe } from "@angular/common";
import { NgModule } from "@angular/core";
import { FormsModule, ReactiveFormsModule } from "@angular/forms";

import {
  AsyncActionsModule,
  AutofocusDirective,
  ButtonModule,
  CalloutModule,
  CheckboxModule,
  DialogModule,
  FormFieldModule,
  IconButtonModule,
  SvgModule,
  LinkModule,
  MenuModule,
  RadioButtonModule,
  SelectModule,
  TableModule,
  ToastModule,
  TypographyModule,
  CopyClickDirective,
  A11yTitleDirective,
  NoItemsModule,
} from "@bitwarden/components";
import { I18nPipe } from "@bitwarden/ui-common";

import { NotPremiumDirective } from "./billing/directives/not-premium.directive";
import { ApiActionDirective } from "./directives/api-action.directive";
import { BoxRowDirective } from "./directives/box-row.directive";
import { IfFeatureDirective } from "./directives/if-feature.directive";
import { InputStripSpacesDirective } from "./directives/input-strip-spaces.directive";
import { InputVerbatimDirective } from "./directives/input-verbatim.directive";
import { LaunchClickDirective } from "./directives/launch-click.directive";
import { StopClickDirective } from "./directives/stop-click.directive";
import { StopPropDirective } from "./directives/stop-prop.directive";
import { TextDragDirective } from "./directives/text-drag.directive";
import { PluralizePipe } from "./pipes/pluralize.pipe";
import { SearchPipe } from "./pipes/search.pipe";
import { UserNamePipe } from "./pipes/user-name.pipe";
import { UserTypePipe } from "./pipes/user-type.pipe";
import { EllipsisPipe } from "./platform/pipes/ellipsis.pipe";
import { IconComponent } from "./vault/components/icon.component";

/**
 * @deprecated In 95% of cases you want I18nPipe from `@bitwarden/ui-common`. In the other 5%
 * directly import the relevant directive/pipe/component. If you need one of the non standalone
 * pipes/directives/components, make it standalone and import directly.
 *
 * This module is overly large and adds many unrelated modules to your dependency tree.
 * https://angular.dev/guide/ngmodules/overview recommends not using `NgModule`s for new code.
 */
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
    NoItemsModule,
    IconButtonModule,
    SvgModule,
    LinkModule,
    SvgModule,
    TextDragDirective,
    CopyClickDirective,
    A11yTitleDirective,
    AutofocusDirective,

    EllipsisPipe,
    I18nPipe,
    IconComponent,
    IfFeatureDirective,
    InputStripSpacesDirective,
    InputVerbatimDirective,
    LaunchClickDirective,
    StopClickDirective,
    StopPropDirective,
    UserNamePipe,
    UserTypePipe,
  ],
  declarations: [ApiActionDirective, BoxRowDirective, NotPremiumDirective, SearchPipe],
  exports: [
    A11yTitleDirective,
    ApiActionDirective,
    AutofocusDirective,
    ToastModule,
    BoxRowDirective,
    EllipsisPipe,
    I18nPipe,
    IconComponent,
    InputStripSpacesDirective,
    InputVerbatimDirective,
    NotPremiumDirective,
    SearchPipe,
    StopClickDirective,
    StopPropDirective,
    CopyClickDirective,
    LaunchClickDirective,
    UserNamePipe,
    UserTypePipe,
    IfFeatureDirective,
    TextDragDirective,
  ],
  providers: [DatePipe, I18nPipe, SearchPipe, UserNamePipe, UserTypePipe, PluralizePipe],
})
export class JslibModule {}
