import { NgModule } from "@angular/core";
import { FormsModule, ReactiveFormsModule } from "@angular/forms";

import { UserVerificationFormInputComponent } from "@bitwarden/auth/angular";
import { CheckboxModule } from "@bitwarden/components";

import { SharedModule } from "../../../shared/shared.module";

import { CreateCredentialDialogComponent } from "./create-credential-dialog/create-credential-dialog.component";
import { DeleteCredentialDialogComponent } from "./delete-credential-dialog/delete-credential-dialog.component";
import { EnableEncryptionDialogComponent } from "./enable-encryption-dialog/enable-encryption-dialog.component";
import { WebauthnLoginSettingsComponent } from "./webauthn-login-settings.component";

@NgModule({
  imports: [
    SharedModule,
    FormsModule,
    ReactiveFormsModule,
    UserVerificationFormInputComponent,
    CheckboxModule,
  ],
  declarations: [
    WebauthnLoginSettingsComponent,
    CreateCredentialDialogComponent,
    DeleteCredentialDialogComponent,
    EnableEncryptionDialogComponent,
  ],
  exports: [WebauthnLoginSettingsComponent],
})
export class WebauthnLoginSettingsModule {}
