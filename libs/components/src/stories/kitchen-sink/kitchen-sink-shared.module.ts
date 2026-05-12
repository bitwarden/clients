import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";
import { FormsModule, ReactiveFormsModule } from "@angular/forms";
import { RouterModule } from "@angular/router";

import { AsyncActionsModule } from "../../async-actions";
import { AvatarModule } from "../../avatar";
import { BadgeModule } from "../../badge";
import { BannerModule } from "../../banner";
import { BerryComponent } from "../../berry";
import { BreadcrumbsModule } from "../../breadcrumbs";
import { ButtonModule } from "../../button";
import { CalloutModule } from "../../callout";
import { CheckboxModule } from "../../checkbox";
import { ColorPasswordModule } from "../../color-password";
import { DialogModule } from "../../dialog";
import { FormControlModule } from "../../form-control";
import { FormFieldModule } from "../../form-field";
import { HeaderComponent } from "../../header";
import { IconComponent } from "../../icon";
import { IconButtonModule } from "../../icon-button";
import { AutofocusDirective, InputModule } from "../../input";
import { LayoutComponent } from "../../layout";
import { LinkModule } from "../../link";
import { MenuModule } from "../../menu";
import { NavigationModule } from "../../navigation";
import { NoItemsModule } from "../../no-items";
import { PopoverModule } from "../../popover";
import { ProgressBarComponent } from "../../progress";
import { RadioButtonModule } from "../../radio-button";
import { SearchModule } from "../../search";
import { SectionComponent } from "../../section";
import { SelectModule } from "../../select";
import { SvgModule } from "../../svg";
import { TableModule } from "../../table";
import { TabsModule } from "../../tabs";
import { ToggleGroupModule } from "../../toggle-group";
import { TypographyModule } from "../../typography";

@NgModule({
  imports: [
    AutofocusDirective,
    AsyncActionsModule,
    AvatarModule,
    BadgeModule,
    BannerModule,
    BerryComponent,
    BreadcrumbsModule,
    ButtonModule,
    CalloutModule,
    CheckboxModule,
    ColorPasswordModule,
    CommonModule,
    DialogModule,
    FormControlModule,
    FormFieldModule,
    FormsModule,
    HeaderComponent,
    IconButtonModule,
    IconComponent,
    SvgModule,
    InputModule,
    LayoutComponent,
    LinkModule,
    MenuModule,
    NavigationModule,
    NoItemsModule,
    PopoverModule,
    ProgressBarComponent,
    RadioButtonModule,
    ReactiveFormsModule,
    RouterModule,
    SearchModule,
    SectionComponent,
    SelectModule,
    TableModule,
    TabsModule,
    ToggleGroupModule,
    TypographyModule,
  ],
  exports: [
    AutofocusDirective,
    AsyncActionsModule,
    AvatarModule,
    BadgeModule,
    BannerModule,
    BerryComponent,
    BreadcrumbsModule,
    ButtonModule,
    CalloutModule,
    CheckboxModule,
    ColorPasswordModule,
    CommonModule,
    DialogModule,
    FormControlModule,
    FormFieldModule,
    FormsModule,
    HeaderComponent,
    IconButtonModule,
    IconComponent,
    SvgModule,
    InputModule,
    LayoutComponent,
    LinkModule,
    MenuModule,
    NavigationModule,
    NoItemsModule,
    PopoverModule,
    ProgressBarComponent,
    RadioButtonModule,
    ReactiveFormsModule,
    RouterModule,
    SearchModule,
    SectionComponent,
    SelectModule,
    TableModule,
    TabsModule,
    ToggleGroupModule,
    TypographyModule,
  ],
})
export class KitchenSinkSharedModule {}
