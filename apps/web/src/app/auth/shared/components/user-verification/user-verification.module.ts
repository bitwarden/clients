import { NgModule } from "@angular/core";
import { FormsModule, ReactiveFormsModule } from "@angular/forms";

import { SharedModule } from "../../../../shared/shared.module";

import { UserVerificationComponent } from "./user-verification.component";

@NgModule({
  imports: [SharedModule, FormsModule, ReactiveFormsModule],
  declarations: [UserVerificationComponent],
  exports: [UserVerificationComponent],
})
export class UserVerificationModule {}
