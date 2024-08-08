import { Overlay } from "@angular/cdk/overlay";
import { inject, Injectable } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { DialogService } from "@bitwarden/components";
import { CipherFormGenerationService } from "@bitwarden/vault";

import { VaultGeneratorDialogComponent } from "../components/vault-v2/vault-generator-dialog/vault-generator-dialog.component";

@Injectable()
export class BrowserCipherFormGenerationService implements CipherFormGenerationService {
  private dialogService = inject(DialogService);
  private overlay = inject(Overlay);

  async generatePassword(): Promise<string> {
    const dialogRef = VaultGeneratorDialogComponent.open(this.dialogService, this.overlay, {
      data: { type: "password" },
    });

    const result = await firstValueFrom(dialogRef.closed);

    if (result == null || result.action === "canceled") {
      return null;
    }

    return result.generatedValue;
  }

  async generateUsername(): Promise<string> {
    const dialogRef = VaultGeneratorDialogComponent.open(this.dialogService, this.overlay, {
      data: { type: "username" },
    });

    const result = await firstValueFrom(dialogRef.closed);

    if (result == null || result.action === "canceled") {
      return null;
    }

    return result.generatedValue;
  }
}
