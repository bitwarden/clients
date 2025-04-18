import { inject, Injectable } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { DialogService } from "@bitwarden/components";
import { CipherFormGenerationService } from "@bitwarden/vault";

import { CredentialGeneratorDialogComponent } from "../vault/app/vault/credential-generator-dialog.component";

@Injectable()
export class DesktopCredentialGenerationService implements CipherFormGenerationService {
  private dialogService = inject(DialogService);

  async generatePassword(): Promise<string> {
    return this.generateCredential("password");
  }

  async generateUsername(): Promise<string> {
    return this.generateCredential("username");
  }

  async generateCredential(type: "password" | "username"): Promise<string> {
    const dialogRef = CredentialGeneratorDialogComponent.open(this.dialogService, { type });

    const result = await firstValueFrom(dialogRef.closed);

    if (!result || result.action === "canceled" || !result.generatedValue) {
      return "";
    }

    return result.generatedValue;
  }
}
