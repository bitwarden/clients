import { DragDropModule } from "@angular/cdk/drag-drop";
import { CommonModule, DatePipe } from "@angular/common";
import { NgModule } from "@angular/core";
import { FormsModule, ReactiveFormsModule } from "@angular/forms";
import { RouterModule } from "@angular/router";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import {
  EnterBillingAddressComponent,
  EnterPaymentMethodComponent,
  BannerModule,
  AsyncActionsModule,
  AvatarModule,
  BadgeListModule,
  BadgeModule,
  ButtonModule,
  CalloutModule,
  CheckboxModule,
  ColorPasswordModule,
  ContainerComponent,
  DialogModule,
  FormFieldModule,
  IconButtonModule,
  IconModule,
  LinkModule,
  MenuModule,
  MultiSelectModule,
  NoItemsModule,
  ProgressModule,
  RadioButtonModule,
  SectionComponent,
  SelectModule,
  TableModule,
  TabsModule,
  ToggleGroupModule,
  TypographyModule,
} from "@bitwarden/components";
import { DiscountBadgeComponent } from "@bitwarden/pricing";

import { AdjustStorageDialogComponent } from "./adjust-storage-dialog/adjust-storage-dialog.component";
import { BillingHistoryComponent } from "./billing-history.component";
import { OffboardingSurveyComponent } from "./offboarding-survey.component";
import { PlanCardComponent } from "./plan-card/plan-card.component";
import { PricingSummaryComponent } from "./pricing-summary/pricing-summary.component";
import { IndividualSelfHostingLicenseUploaderComponent } from "./self-hosting-license-uploader/individual-self-hosting-license-uploader.component";
import { OrganizationSelfHostingLicenseUploaderComponent } from "./self-hosting-license-uploader/organization-self-hosting-license-uploader.component";
import { SecretsManagerSubscribeComponent } from "./sm-subscribe.component";
import { TrialPaymentDialogComponent } from "./trial-payment-dialog/trial-payment-dialog.component";
import { UpdateLicenseDialogComponent } from "./update-license-dialog.component";
import { UpdateLicenseComponent } from "./update-license.component";

@NgModule({
  imports: [
    BannerModule,
    EnterPaymentMethodComponent,
    EnterBillingAddressComponent,
    DiscountBadgeComponent,

    CommonModule,
    DragDropModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule,
    JslibModule,

    // Component library modules
    // Only add components that are used almost everywhere in the application
    AsyncActionsModule,
    AvatarModule,
    BadgeListModule,
    BadgeModule,
    ButtonModule,
    CalloutModule,
    CheckboxModule,
    ColorPasswordModule,
    ContainerComponent,
    DialogModule,
    FormFieldModule,
    IconButtonModule,
    IconModule,
    LinkModule,
    MenuModule,
    MultiSelectModule,
    NoItemsModule,
    ProgressModule,
    RadioButtonModule,
    SectionComponent,
    TableModule,
    TabsModule,
    ToggleGroupModule,
    TypographyModule,

    // Web specific
  ],
  declarations: [
    BillingHistoryComponent,
    SecretsManagerSubscribeComponent,
    UpdateLicenseComponent,
    UpdateLicenseDialogComponent,
    OffboardingSurveyComponent,
    AdjustStorageDialogComponent,
    IndividualSelfHostingLicenseUploaderComponent,
    OrganizationSelfHostingLicenseUploaderComponent,
    TrialPaymentDialogComponent,
    PlanCardComponent,
    PricingSummaryComponent,
  ],
  exports: [
    BillingHistoryComponent,
    SecretsManagerSubscribeComponent,
    UpdateLicenseComponent,
    UpdateLicenseDialogComponent,
    OffboardingSurveyComponent,
    IndividualSelfHostingLicenseUploaderComponent,
    OrganizationSelfHostingLicenseUploaderComponent,
    DiscountBadgeComponent,

    CommonModule,
    DragDropModule,
    FormsModule,
    ReactiveFormsModule,
    RouterModule,
    JslibModule,

    // Component library
    AsyncActionsModule,
    AvatarModule,
    BadgeListModule,
    BadgeModule,
    ButtonModule,
    CalloutModule,
    CheckboxModule,
    ColorPasswordModule,
    ContainerComponent,
    DialogModule,
    FormFieldModule,
    IconButtonModule,
    IconModule,
    LinkModule,
    MenuModule,
    MultiSelectModule,
    NoItemsModule,
    ProgressModule,
    RadioButtonModule,
    SectionComponent,
    SelectModule,
    TableModule,
    TabsModule,
    ToggleGroupModule,
    TypographyModule,

    // Web specific
  ],
  providers: [DatePipe],
})
export class BillingSharedModule {}
