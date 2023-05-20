import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";

import { SpinnerComponent } from "../spinner";

import { BitIconButtonComponent } from "./icon-button.component";

@NgModule({
  imports: [CommonModule, SpinnerComponent],
  declarations: [BitIconButtonComponent],
  exports: [BitIconButtonComponent],
})
export class IconButtonModule {}
