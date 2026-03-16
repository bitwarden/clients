import { Overlay } from "@angular/cdk/overlay";
import { inject, Injectable } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { DialogService } from "@bitwarden/components";
import { SendFormGenerationService } from "@bitwarden/send-ui";

import { BrowserSendGeneratorDialogComponent } from "../send-generator-dialog/send-generator-dialog.component";

/**
 * Browser-specific implementation of SendFormGenerationService.
 * Opens the password generator in a full-screen popup page layout
 * with back-arrow navigation, matching the vault Login generator behavior.
 */
@Injectable()
export class BrowserSendFormGenerationService implements SendFormGenerationService {
  private dialogService = inject(DialogService);
  private overlay = inject(Overlay);

  async generatePassword(): Promise<string | null> {
    const dialogRef = BrowserSendGeneratorDialogComponent.open(this.dialogService, this.overlay, {
      data: { type: "password" },
    });

    const result = await firstValueFrom(dialogRef.closed);

    if (result == null || result.action === "canceled") {
      return null;
    }

    return result.generatedValue || null;
  }
}
