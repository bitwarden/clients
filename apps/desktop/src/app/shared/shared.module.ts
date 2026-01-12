import { A11yModule } from "@angular/cdk/a11y";
import { DragDropModule } from "@angular/cdk/drag-drop";
import { OverlayModule } from "@angular/cdk/overlay";
import { ScrollingModule } from "@angular/cdk/scrolling";
import { CommonModule, DatePipe } from "@angular/common";
import { NgModule } from "@angular/core";
import { FormsModule, ReactiveFormsModule } from "@angular/forms";

import { JslibModule } from "@bitwarden/angular/jslib.module";

import { AvatarComponent } from "../components/avatar.component";
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
  declarations: [AvatarComponent],
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
    AvatarComponent,
  ],
  providers: [DatePipe],
})
export class SharedModule {}
