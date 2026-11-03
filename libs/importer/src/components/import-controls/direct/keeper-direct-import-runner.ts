import { Injectable, inject } from "@angular/core";
import { FormControl } from "@angular/forms";
import { firstValueFrom } from "rxjs";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { DialogService } from "@bitwarden/components";

import { KeeperRegion } from "../../../importers/keeper/access";
import { ImportRecordError, ImportResult } from "../../../models";
import { ImportUpgradeServiceAbstraction } from "../../../services";
import { keeperImportGate, shouldSubmitAfterDialog } from "../../keeper/keeper-import-gate";
import { keeperValidationErrorI18nKey } from "../../keeper/keeper-validation-error";
import {
  PartialImportDialogComponent,
  PartialImportDialogData,
} from "../../keeper/partial-import-dialog.component";
import { ImportOutcome } from "../import-outcome";

import { KeeperDirectImportUpgradeService } from "./keeper/keeper-direct-import-upgrade.service";
import { KeeperInlineAuthUi } from "./keeper/keeper-inline-auth-ui";

@Injectable()
export class KeeperDirectImportRunner {
  private readonly keeperDirectImportService = inject(KeeperDirectImportUpgradeService);
  private readonly keeperUi = inject(KeeperInlineAuthUi);
  private readonly importService = inject(ImportUpgradeServiceAbstraction);
  private readonly dialogService = inject(DialogService);
  private readonly i18nService = inject(I18nService);
  private readonly logService = inject(LogService);

  async run(
    email: FormControl<string | null>,
    region: FormControl<KeeperRegion>,
  ): Promise<ImportOutcome> {
    // Captured now: a later login replaces the current session, and this one must not read it.
    const session = this.keeperUi.session;
    let handled: { result: ImportResult; errors: ImportRecordError[] };
    try {
      handled = await this.keeperDirectImportService.handleImport(
        email.value!,
        region.value,
        session,
      );
    } catch (error) {
      // Leaving mid-login cancels it; that isn't a login failure to show on the email field.
      if (session.userLeft()) {
        return { kind: "cancelled" };
      }
      this.logService.error(`Keeper importer error: ${error}`);
      // The card already showed this failure as a toast.
      if (session.errorReported()) {
        return { kind: "cancelled" };
      }
      email.setErrors({
        errors: { message: this.i18nService.t(keeperValidationErrorI18nKey(error)) },
      });
      email.markAsTouched();
      return { kind: "cancelled" };
    }

    // The login can still finish after the user left, if no further prompt was needed.
    if (session.userLeft()) {
      return { kind: "cancelled" };
    }
    session.beginImport();

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
