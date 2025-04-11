import { inject, Injectable } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { DialogService } from "@bitwarden/components";
import { CipherFormGenerationService } from "@bitwarden/vault";

import { CredentialGeneratorDialogComponent } from "../vault/app/vault/credential-generator-dialog-v2.component";

@Injectable()
export class DesktopCredentialGenerationService implements CipherFormGenerationService {
  private dialogService = inject(DialogService);

  async generatePassword(): Promise<string> {
    return this.generateCredential("password");
  }

  async generateUsername(uri: string): Promise<string> {
    return this.generateCredential("username", uri);
  }

  async generateCredential(type: "password" | "username", uri?: string): Promise<string> {
    const dialogRef = CredentialGeneratorDialogComponent.open(this.dialogService, {
      data: { type, uri },
    });

    const result = await firstValueFrom(dialogRef.closed);

    if (!result || result.action === "canceled" || !result.generatedValue) {
      return "";
    }

    return result.generatedValue;
  }
}
