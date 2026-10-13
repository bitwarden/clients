import { Injectable, inject } from "@angular/core";
import { FormControl } from "@angular/forms";
import { firstValueFrom } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { DialogService } from "@bitwarden/components";

import { KeeperRegion } from "../../../importers/keeper/access";
import { ImportRecordError, ImportResult } from "../../../models";
import { ImportUpgradeServiceAbstraction } from "../../../services";
import { KeeperDirectImportService } from "../../keeper/keeper-direct-import.service";
import { keeperImportGate, shouldSubmitAfterDialog } from "../../keeper/keeper-import-gate";
import { keeperValidationErrorI18nKey } from "../../keeper/keeper-validation-error";
import {
  PartialImportDialogComponent,
  PartialImportDialogData,
} from "../../keeper/partial-import-dialog.component";
import { ImportOutcome } from "../import-outcome";

@Injectable()
export class KeeperDirectImportRunner {
  private readonly keeperDirectImportService = inject(KeeperDirectImportService);
  private readonly importService = inject(ImportUpgradeServiceAbstraction);
  private readonly dialogService = inject(DialogService);
  private readonly i18nService = inject(I18nService);
  private readonly logService = inject(LogService);

  async run(
    email: FormControl<string | null>,
    region: FormControl<KeeperRegion>,
  ): Promise<ImportOutcome> {
    let handled: { result: ImportResult; errors: ImportRecordError[] };
    try {
      handled = await this.keeperDirectImportService.handleImport(
        email.value!,
        region.value,
        undefined,
      );
    } catch (error) {
      this.logService.error(`Keeper importer error: ${error}`);
      email.setErrors({
        errors: { message: this.i18nService.t(keeperValidationErrorI18nKey(error)) },
      });
      email.markAsTouched();
      return { kind: "cancelled" };
    }

    const { result, errors } = handled;
    const { needsConfirmation, canImport } = keeperImportGate(result, errors);
    if (needsConfirmation) {
      const dialog = this.dialogService.open<boolean, PartialImportDialogData>(
        PartialImportDialogComponent,
        { data: { errors, canImport } },
      );
      const confirmed = await firstValueFrom(dialog.closed);
      if (!shouldSubmitAfterDialog(canImport, confirmed)) {
        return { kind: "cancelled" };
      }
    }

    return {
      kind: "imported",
      result: await this.importService.importImportResult(result, undefined, undefined, false),
    };
  }
}
