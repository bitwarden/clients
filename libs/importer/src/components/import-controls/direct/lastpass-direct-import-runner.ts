import { Injectable, inject } from "@angular/core";
import { FormControl } from "@angular/forms";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";

import { ImportResult } from "../../../models";
import { LastPassDirectImportService } from "../../lastpass/lastpass-direct-import.service";
import { lastPassValidationErrorI18nKey } from "../../lastpass/lastpass-validation-error";
import { ImportOutcome } from "../import-outcome";

@Injectable()
export class LastPassDirectImportRunner {
  private readonly lastPassDirectImportService = inject(LastPassDirectImportService);
  private readonly i18nService = inject(I18nService);
  private readonly logService = inject(LogService);

  async run(
    email: FormControl<string | null>,
    includeSharedFolders: FormControl<boolean | null>,
    importCsv: (csv: string) => Promise<ImportResult>,
  ): Promise<ImportOutcome> {
    let csv: string;
    try {
      csv = await this.lastPassDirectImportService.handleImport(
        email.value!,
        includeSharedFolders.value ?? false,
      );
    } catch (error) {
      this.logService.error(`LP importer error: ${error}`);
      email.setErrors({
        errors: { message: this.i18nService.t(lastPassValidationErrorI18nKey(error)) },
      });
      email.markAsTouched();
      return { kind: "cancelled" };
    }

    return { kind: "imported", result: await importCsv(csv) };
  }
}
