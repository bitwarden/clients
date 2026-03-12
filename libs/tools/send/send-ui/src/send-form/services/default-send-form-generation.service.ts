import { Injectable } from "@angular/core";
import { firstValueFrom } from "rxjs";

import { DialogService } from "@bitwarden/components";

import { SendFormGenerationService } from "../abstractions/send-form-generation.service";
import {
  SendGeneratorDialogComponent,
  SendGeneratorDialogParams,
  SendGeneratorDialogResult,
} from "../components/send-generator-dialog/send-generator-dialog.component";

/**
 * Default implementation of SendFormGenerationService that opens a modal dialog.
 * Used by the web vault and desktop app.
 */
@Injectable()
export class DefaultSendFormGenerationService implements SendFormGenerationService {
  constructor(private dialogService: DialogService) {}

  async generatePassword(): Promise<string | null> {
    const dialogRef = this.dialogService.open<SendGeneratorDialogResult, SendGeneratorDialogParams>(
      SendGeneratorDialogComponent,
      {
        data: { type: "password" },
      },
    );

    const result = await firstValueFrom(dialogRef.closed);

    if (result && result.action === "selected" && result.generatedValue) {
      return result.generatedValue;
    }

    return null;
  }
}
