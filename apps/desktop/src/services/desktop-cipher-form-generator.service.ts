import { inject, Injectable } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { DialogService } from "@bitwarden/components";
import { CipherFormGenerationService } from "@bitwarden/vault";

import { CredentialGeneratorDialogComponent } from "../vault/app/vault/credential-generator-dialog.component";

@Injectable()
export class DesktopCredentialGenerationService implements CipherFormGenerationService {
  private dialogService = inject(DialogService);

  async generatePassword(): Promise<string> {
    return await this.generateCredential("password");
  }

  async generateUsername(uri: string): Promise<string> {
    return await this.generateCredential("username", uri);
  }

  async generateCredential(type: "password" | "username", uri?: string): Promise<string> {
    const dialogRef = CredentialGeneratorDialogComponent.open(this.dialogService, { type, uri });

    const result = await firstValueFrom(dialogRef.closed);

    if (!result || result.action === "canceled" || !result.generatedValue) {
      return "";
    }

    return result.generatedValue;
  }
}
