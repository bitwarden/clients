import { Injectable, inject } from "@angular/core";
import { lastValueFrom } from "rxjs";

import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";
import { DialogService } from "@bitwarden/components";

import {
  OnePasswordImportSummary,
  OnePasswordSignInDomain,
  OnePasswordTwoFactorUi,
  isOnePasswordCredentialError,
  onePasswordErrorMessageKey,
} from "../../sdk";
import { ImportServiceAbstraction } from "../../services/import.service.abstraction";

import {
  OnePasswordCredentialsPromptComponent,
  OnePasswordTwoFactorPromptComponent,
} from "./dialog";

/** The 1Password account to import, as entered in the import form. */
export interface OnePasswordAccount {
  email: string;
  subdomain: string;
  domain: OnePasswordSignInDomain;
}

/**
 * Runs a direct 1Password import through the SDK.
 *
 * Unlike the Keeper and LastPass direct importers, which reimplement their vendor's protocol in
 * TypeScript, this one has no protocol logic: the SDK signs in, downloads and decrypts the vaults,
 * and submits them. All this contributes are the prompts: the Secret Key and password, asked for
 * before signing in, and the two-factor code, which the SDK calls back for.
 */
@Injectable()
export class OnePasswordDirectImportService {
  private readonly dialogService = inject(DialogService);
  private readonly i18nService = inject(I18nService);
  private readonly importService = inject(ImportServiceAbstraction);

  /**
   * Imports the account, or resolves with `undefined` when the user cancels one of the prompts. A
   * refused password or Secret Key asks for both again, saying why; any other failure is thrown.
   */
  async handleImport(
    account: OnePasswordAccount,
    organizationId: OrganizationId | undefined,
    selectedImportTarget: FolderView | CollectionView | undefined,
    canAccessImportExport: boolean,
  ): Promise<OnePasswordImportSummary | undefined> {
    let error: string | undefined;
    for (;;) {
      const entered = await lastValueFrom(
        OnePasswordCredentialsPromptComponent.open(this.dialogService, {
          email: account.email,
          error,
        }).closed,
      );
      if (entered == null) {
        return undefined;
      }

      const twoFactor = this.twoFactorUi(account.email);
      try {
        return await this.importService.importOnePassword(
          {
            credentials: {
              username: account.email,
              password: entered.password,
              account_key: entered.secretKey.trim(),
              sign_in_address: { subdomain: account.subdomain, domain: account.domain },
            },
            twoFactorUi: twoFactor.ui,
          },
          organizationId,
          selectedImportTarget,
          canAccessImportExport,
        );
      } catch (e) {
        if (twoFactor.cancelled()) {
          return undefined;
        }
        if (!isOnePasswordCredentialError(e)) {
          throw e;
        }
        error = this.i18nService.t(onePasswordErrorMessageKey(e) ?? "errorOccurred");
      }
    }
  }

  /**
   * The prompt the SDK drives. It only calls this for accounts with two-factor verification
   * enabled, and again on each wrong code, since 1Password invalidates the session and restarts the
   * sign-in. Returning undefined cancels the import, which `cancelled` then reports.
   */
  private twoFactorUi(email: string): { ui: OnePasswordTwoFactorUi; cancelled: () => boolean } {
    let cancelled = false;
    return {
      ui: {
        provideTotp: async (attempt: number): Promise<string | undefined> => {
          const dialog = OnePasswordTwoFactorPromptComponent.open(this.dialogService, {
            email,
            previousCodeRejected: attempt > 0,
          });
          const code = await lastValueFrom(dialog.closed);
          cancelled = code == null;
          return code;
        },
      },
      cancelled: () => cancelled,
    };
  }
}
