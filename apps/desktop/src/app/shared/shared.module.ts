import { A11yModule } from "@angular/cdk/a11y";
import { DragDropModule } from "@angular/cdk/drag-drop";
import { OverlayModule } from "@angular/cdk/overlay";
import { ScrollingModule } from "@angular/cdk/scrolling";
import { CommonModule, DatePipe } from "@angular/common";
import { NgModule } from "@angular/core";
import { FormsModule, ReactiveFormsModule } from "@angular/forms";

import { JslibModule } from "@bitwarden/angular/jslib.module";
import { IconModule } from "@bitwarden/components";

import { AvatarComponent } from "../components/avatar.component";
import { ServicesModule } from "../services/services.module";

/**
 * @deprecated Please directly import the relevant directive/pipe/component.
 *
 * This module is overly large and adds many unrelated modules to your dependency tree.
 * https://angular.dev/guide/ngmodules/overview recommends not using `NgModule`s for new code.
 */
@NgModule({
  imports: [
    CommonModule,
    A11yModule,
    DragDropModule,
    FormsModule,
    IconModule,
    JslibModule,
    OverlayModule,
    ReactiveFormsModule,
    ScrollingModule,
    ServicesModule,
  ],
  declarations: [AvatarComponent],
  exports: [
    CommonModule,
    A11yModule,
    DatePipe,
    DragDropModule,
    FormsModule,
    IconModule,
    JslibModule,
    OverlayModule,
    ReactiveFormsModule,
    ScrollingModule,
    ServicesModule,
    AvatarComponent,
  ],
  providers: [DatePipe],
})
export class SharedModule {}
