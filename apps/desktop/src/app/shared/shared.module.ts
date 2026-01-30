import { A11yModule } from "@angular/cdk/a11y";
import { DragDropModule } from "@angular/cdk/drag-drop";
import { OverlayModule } from "@angular/cdk/overlay";
import { ScrollingModule } from "@angular/cdk/scrolling";
import { CommonModule, DatePipe } from "@angular/common";
import { NgModule } from "@angular/core";
import { FormsModule, ReactiveFormsModule } from "@angular/forms";

import { JslibModule } from "@bitwarden/angular/jslib.module";

import { ServicesModule } from "../services/services.module";

@NgModule({
  imports: [
    CommonModule,
    A11yModule,
    DragDropModule,
    FormsModule,
    JslibModule,
    OverlayModule,
    ReactiveFormsModule,
    ScrollingModule,
    ServicesModule,
  ],
  declarations: [],
  exports: [
    CommonModule,
    A11yModule,
    DatePipe,
    DragDropModule,
    FormsModule,
    JslibModule,
    OverlayModule,
    ReactiveFormsModule,
    ScrollingModule,
    ServicesModule,
  ],
  providers: [DatePipe],
})
export class SharedModule {}
