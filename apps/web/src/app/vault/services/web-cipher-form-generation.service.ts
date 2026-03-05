// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { inject, Injectable } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { DialogService } from "@bitwarden/components";
import { CipherFormGenerationService } from "@bitwarden/vault";

import { WebVaultGeneratorDialogComponent } from "../components/web-generator-dialog/web-generator-dialog.component";

@Injectable()
export class WebCipherFormGenerationService implements CipherFormGenerationService {
  private dialogService = inject(DialogService);

  async generatePassword(): Promise<string> {
    const dialogRef = WebVaultGeneratorDialogComponent.open(this.dialogService, {
      data: { type: "password" },
    });

    const result = await firstValueFrom(dialogRef.closed);

    if (result == null || result.action === "canceled") {
      return null;
    }

    return result.generatedValue;
  }

  async generateUsername(uri: string): Promise<string> {
    const dialogRef = WebVaultGeneratorDialogComponent.open(this.dialogService, {
      data: { type: "username", uri: uri },
    });

    const result = await firstValueFrom(dialogRef.closed);

    if (result == null || result.action === "canceled") {
      return null;
    }

    return result.generatedValue;
  }
}
