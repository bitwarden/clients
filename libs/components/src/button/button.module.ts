import { CommonModule } from "@angular/common";
import { NgModule } from "@angular/core";

import { SpinnerComponent } from "../spinner";

import { ButtonComponent } from "./button.component";

@NgModule({
  imports: [CommonModule, SpinnerComponent],
  exports: [ButtonComponent],
  declarations: [ButtonComponent],
})
export class ButtonModule {}
