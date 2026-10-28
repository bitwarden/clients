import { Injectable, inject } from "@angular/core";
import { FormControl } from "@angular/forms";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";

import { ImportResult } from "../../../models";
import { LastPassDirectImportService } from "../../lastpass/lastpass-direct-import.service";
import { lastPassValidationErrorI18nKey } from "../../lastpass/lastpass-validation-error";
import { ImportOutcome } from "../import-outcome";

import { LastPassInlineAuthUi } from "./lastpass/lastpass-inline-auth-ui";

@Injectable()
export class LastPassDirectImportRunner {
  private readonly lastPassDirectImportService = inject(LastPassDirectImportService);
  private readonly lastPassUi = inject(LastPassInlineAuthUi);
  private readonly i18nService = inject(I18nService);
  private readonly logService = inject(LogService);

  async run(
    email: FormControl<string | null>,
    includeSharedFolders: FormControl<boolean | null>,
    importCsv: (csv: string) => Promise<ImportResult>,
  ): Promise<ImportOutcome> {
    // Captured now: a later login replaces the current session, and this one must not read it.
    const session = this.lastPassUi.session;
    let csv: string;
    try {
      csv = await this.lastPassDirectImportService.handleImport(
        email.value!,
        includeSharedFolders.value ?? false,
        session,
      );
    } catch (error) {
      // Leaving mid-login cancels it; that isn't a login failure to show.
      if (session.userLeft) {
        return { kind: "cancelled" };
      }
      this.logService.error(`LP importer error: ${error}`);
      const messageKey = lastPassValidationErrorI18nKey(error);
      // A rejected password never gets here (it is asked for again), so this is the account.
      if (messageKey === "incorrectUsernameOrPassword") {
        email.setErrors({ errors: { message: this.i18nService.t(messageKey) } });
        email.markAsTouched();
      } else {
        this.lastPassUi.fail(session, messageKey);
      }
      return { kind: "cancelled" };
    }

    // The login can still finish after the user left, if no further prompt was needed.
    if (session.userLeft) {
      return { kind: "cancelled" };
    }
    session.beginImport();

    return { kind: "imported", result: await importCsv(csv) };
  }
}
