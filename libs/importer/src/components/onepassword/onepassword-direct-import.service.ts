import { Injectable, inject } from "@angular/core";

import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";
import { DialogRef, DialogService } from "@bitwarden/components";

import {
  OnePasswordErrorField,
  OnePasswordImportSummary,
  OnePasswordSignInDomain,
  OnePasswordTwoFactorUi,
  onePasswordErrorDisplay,
} from "../../sdk";
import { ImportServiceAbstraction } from "../../services/import.service.abstraction";

import {
  OnePasswordCredentialsPromptComponent,
  OnePasswordCredentialsRejection,
  OnePasswordSecretKeyAndPassword,
  OnePasswordTwoFactorPromptComponent,
} from "./dialog";
import { onePasswordSignInDomainLabel } from "./onepassword-sign-in-domains";

/** The 1Password account to import, as entered in the import form. */
export interface OnePasswordAccount {
  email: string;
  subdomain: string;
  domain: OnePasswordSignInDomain;
}

/** A failed import as the user sees it. */
export interface OnePasswordErrorDescription {
  /** The field to mark, or `undefined` for a toast. */
  field?: OnePasswordErrorField;
  message: string;
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
   * Imports the account, or resolves with `undefined` when the user cancels one of the prompts.
   *
   * Only the Continue button of the open prompt shows the import is running. The Secret Key and
   * password prompt stays open until the import is over, unless the account has two-factor
   * verification, which takes its place. A refused Secret Key, password or code is marked on its
   * field for the user to correct; any other failure closes the prompts and is thrown.
   */
  handleImport(
    account: OnePasswordAccount,
    organizationId: OrganizationId | undefined,
    selectedImportTarget: FolderView | CollectionView | undefined,
    canAccessImportExport: boolean,
  ): Promise<OnePasswordImportSummary | undefined> {
    return new Promise((resolve, reject) => {
      let signingIn = false;
      // Two-factor verification takes the place of the Secret Key and password prompt.
      const twoFactor = new TwoFactorPrompt(
        this.dialogService,
        account.email,
        () => void credentialsDialog.close(),
      );

      const signIn = async (
        entered: OnePasswordSecretKeyAndPassword,
      ): Promise<OnePasswordCredentialsRejection | undefined> => {
        signingIn = true;
        let settle: () => void;
        try {
          const summary = await this.importService.importOnePassword(
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
          settle = () => resolve(summary);
        } catch (error) {
          if (twoFactor.cancelled) {
            settle = () => resolve(undefined);
          } else {
            const { field, message } = this.describeError(error, account.domain);
            // Once two-factor verification takes over, the Secret Key and password are behind it.
            if ((field === "secretKey" || field === "password") && !twoFactor.opened) {
              signingIn = false;
              return { field, message };
            }
            settle = () => reject(error);
          }
        }
        void credentialsDialog.close();
        twoFactor.close();
        settle();
        return undefined;
      };

      const credentialsDialog = OnePasswordCredentialsPromptComponent.open(this.dialogService, {
        email: account.email,
        signIn,
      });
      credentialsDialog.closed.subscribe(() => {
        if (!signingIn) {
          resolve(undefined);
        }
      });
    });
  }

  /** How a failed import of an account on `domain` is shown. */
  describeError(error: unknown, domain: OnePasswordSignInDomain): OnePasswordErrorDescription {
    const { field, messageKey } = onePasswordErrorDisplay(error);
    return {
      field,
      message: this.i18nService.t(messageKey, onePasswordSignInDomainLabel(domain)),
    };
  }
}

/**
 * The two-factor prompt the SDK drives. The SDK only asks for accounts with two-factor verification
 * turned on, and asks again after each refused code, since 1Password then restarts the sign-in. The
 * prompt opens on the first request and stays open across the others.
 */
class TwoFactorPrompt {
  private dialog: DialogRef<undefined> | undefined;
  /** Answers the SDK's pending request: with a code, or `undefined` to cancel the import. */
  private answer: ((code: string | undefined) => void) | undefined;
  /** Tells the prompt whether 1Password refused the code it is waiting on. */
  private reportRefused: ((refused: boolean) => void) | undefined;
  private cancelledByUser = false;

  readonly ui: OnePasswordTwoFactorUi = {
    provideTotp: () =>
      new Promise((resolve) => {
        this.answer = resolve;
        if (this.dialog == null) {
          this.open();
        } else {
          this.report(true);
        }
      }),
  };

  constructor(
    private readonly dialogService: DialogService,
    private readonly email: string,
    private readonly onOpen: () => void,
  ) {}

  get opened(): boolean {
    return this.dialog != null;
  }

  /** Whether the user dismissed the prompt, which the SDK reports as a failure. */
  get cancelled(): boolean {
    return this.cancelledByUser;
  }

  close(): void {
    this.report(false);
    void this.dialog?.close();
  }

  private open(): void {
    this.onOpen();
    this.dialog = OnePasswordTwoFactorPromptComponent.open(this.dialogService, {
      email: this.email,
      submitCode: (code) =>
        new Promise<boolean>((resolve) => {
          this.reportRefused = resolve;
          this.respond(code);
        }),
    });
    this.dialog.closed.subscribe(() => {
      if (this.answer != null) {
        this.cancelledByUser = true;
        this.respond(undefined);
      }
    });
  }

  private respond(code: string | undefined): void {
    const answer = this.answer;
    this.answer = undefined;
    answer?.(code);
  }

  private report(refused: boolean): void {
    const reportRefused = this.reportRefused;
    this.reportRefused = undefined;
    reportRefused?.(refused);
  }
}
