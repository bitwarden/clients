import { NgModule } from "@angular/core";
import { FormsModule, ReactiveFormsModule } from "@angular/forms";

import { SharedModule } from "../../../../shared/shared.module";

import { UserVerificationPromptComponent } from "./user-verification-prompt.component";
import { UserVerificationComponent } from "./user-verification.component";

@NgModule({
  imports: [SharedModule, FormsModule, ReactiveFormsModule],
  declarations: [UserVerificationComponent, UserVerificationPromptComponent],
  exports: [UserVerificationComponent, UserVerificationPromptComponent],
})
export class UserVerificationModule {}
