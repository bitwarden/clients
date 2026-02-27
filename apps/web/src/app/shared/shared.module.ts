import { DragDropModule } from "@angular/cdk/drag-drop";
import { CommonModule, DatePipe } from "@angular/common";
import { NgModule } from "@angular/core";
import { FormsModule, ReactiveFormsModule } from "@angular/forms";
import { RouterModule } from "@angular/router";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import {
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
  SvgModule,
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

/**
 * @deprecated Please directly import the relevant directive/pipe/component.
 *
 * This module is overly large and adds many unrelated modules to your dependency tree.
 * https://angular.dev/guide/ngmodules/overview recommends not using `NgModule`s for new code.
 */
@NgModule({
  imports: [
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
    SvgModule,
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
  exports: [
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
    SvgModule,
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
  bootstrap: [],
})
export class SharedModule {}
