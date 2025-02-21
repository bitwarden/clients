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
  LinkModule,
  MenuModule,
  MultiSelectModule,
  ProgressModule,
  RadioButtonModule,
  SectionComponent,
  SelectModule,
  TableModule,
  TabsModule,
  ToggleGroupModule,
  TypographyModule,
} from "@bitwarden/components";

// Register the locales for the application
import "./locales";

/**
 * This NgModule should contain the most basic shared directives, pipes, and components. They
 * should be widely used by other modules to be considered for adding to this module. If in doubt
 * do not add to this module.
 *
 * See: https://angular.io/guide/module-types#shared-ngmodules
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
    LinkModule,
    MenuModule,
    MultiSelectModule,
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
    LinkModule,
    MenuModule,
    MultiSelectModule,
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
