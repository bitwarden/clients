import { Injectable, OnDestroy, inject, signal } from "@angular/core";

import { CollectionView } from "@bitwarden/common/admin-console/models/collections";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { OrganizationId } from "@bitwarden/common/types/guid";
import { FolderView } from "@bitwarden/common/vault/models/view/folder.view";
import { DialogRef, DialogService } from "@bitwarden/components";

import {
  OnePasswordErrorField,
  OnePasswordImportSummary,
  OnePasswordSignInDomain,
  OnePasswordSsoEnrollment,
  OnePasswordSsoEnrollmentStatus,
  OnePasswordTwoFactorUi,
  onePasswordErrorDisplay,
} from "../../sdk";
import { ImportServiceAbstraction } from "../../services/import.service.abstraction";

import {
  OnePasswordCredentialsPromptComponent,
  OnePasswordCredentialsRejection,
  OnePasswordSecretKeyAndPassword,
  OnePasswordSsoEnrollmentPromptComponent,
  OnePasswordTwoFactorPromptComponent,
} from "./dialog";
import { OnePasswordSsoBrowser } from "./onepassword-sso-browser";

/** The 1Password account to import, as entered in the import form. */
export interface OnePasswordAccount {
  email: string;
  subdomain: string;
  domain: OnePasswordSignInDomain;
}

/** How the account signs in on this client. */
export type OnePasswordSignInMethod = "password" | "sso";

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
 * before signing in, and the two-factor code, which the SDK calls back for. For an account that
 * signs in through its identity provider, these are the browser step of that login and the
 * approval of the device, which is a new one on every import.
 */
@Injectable()
export class OnePasswordDirectImportService implements OnDestroy {
  private readonly dialogService = inject(DialogService);
  private readonly i18nService = inject(I18nService);
  private readonly importService = inject(ImportServiceAbstraction);
  private readonly ssoBrowser = inject(OnePasswordSsoBrowser);

  private destroyed = false;
  private activeEnrollment: SsoEnrollmentPrompt | undefined;

  /**
   * Asks 1Password how the account signs in and picks the method to import it with, or resolves
   * with `undefined` when the account offers none this client supports. An account that offers both
   * is imported with the password, which needs no approval of a new device.
   */
  async signInMethod(account: OnePasswordAccount): Promise<OnePasswordSignInMethod | undefined> {
    const offered = await this.importService.onePasswordSignInMethods(account.email, {
      subdomain: account.subdomain,
      domain: account.domain,
    });
    if (offered.password) {
      return "password";
    }
    if (offered.sso && this.ssoBrowser.supported) {
      return "sso";
    }
    return undefined;
  }

  /**
   * Imports the account, or resolves with `undefined` when the user cancels one of the prompts.
   *
   * Only the Continue button of the open prompt shows the import is running. The Secret Key and
   * password prompt stays open until the import is over, unless the account has two-factor
   * verification, which takes its place. The user can try again after a refused Secret Key,
   * password or code, which the open prompt reports; any other failure closes the prompts and is
   * thrown.
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
            const description = this.describeError(error);
            // Once two-factor verification takes over, the Secret Key and password are behind it.
            if (
              (description?.field === "secretKey" ||
                description?.field === "secretKeyAndPassword") &&
              !twoFactor.opened
            ) {
              signingIn = false;
              return {
                field: description.field === "secretKey" ? description.field : undefined,
                message: description.message,
              };
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

  /**
   * Imports the account through its identity provider, or resolves with `undefined` when the user
   * cancels one of the steps.
   *
   * The sign-in at the identity provider is up to the {@link OnePasswordSsoBrowser}. Every import
   * is a new device, which is approved from another device that is signed in to 1Password: the
   * enrollment prompt shows how far that has come and takes the verification code the other device
   * displays. Like the Secret Key and password prompt, it stays open until the import is over. Any
   * other failure closes the prompt and is thrown.
   */
  async handleSsoImport(
    account: OnePasswordAccount,
    organizationId: OrganizationId | undefined,
    selectedImportTarget: FolderView | CollectionView | undefined,
    canAccessImportExport: boolean,
  ): Promise<OnePasswordImportSummary | undefined> {
    const enrollment = new SsoEnrollmentPrompt(this.dialogService, account.email);
    this.activeEnrollment = enrollment;
    // The SDK takes a failed browser step for a canceled one, so the failure is kept to throw.
    let failedLogin: { error: unknown } | undefined;

    try {
      return await this.importService.importOnePasswordSso(
        {
          credentials: {
            username: account.email,
            sign_in_address: { subdomain: account.subdomain, domain: account.domain },
          },
          ui: {
            performSsoLogin: async (ssoLoginUrl: string, redirectTo: string) => {
              if (this.destroyed) {
                return undefined;
              }
              try {
                return await this.ssoBrowser.login(ssoLoginUrl, redirectTo);
              } catch (error) {
                failedLogin = { error };
                return undefined;
              }
            },
            beginSsoEnrollment: () =>
              Promise.resolve(this.destroyed ? canceledEnrollment : enrollment.open()),
          },
        },
        organizationId,
        selectedImportTarget,
        canAccessImportExport,
      );
    } catch (error) {
      if (failedLogin != null) {
        throw failedLogin.error;
      }
      if (onePasswordErrorDisplay(error) == null) {
        return undefined;
      }
      throw error;
    } finally {
      enrollment.close();
      if (this.activeEnrollment === enrollment) {
        this.activeEnrollment = undefined;
      }
    }
  }

  /** Calls off the steps of a single sign-on import that are waiting for the user. */
  ngOnDestroy(): void {
    this.destroyed = true;
    this.ssoBrowser.cancel();
    this.activeEnrollment?.close();
  }

  /**
   * How a failed import is shown, or `undefined` when the user canceled it and there is nothing to
   * show.
   */
  describeError(error: unknown): OnePasswordErrorDescription | undefined {
    const display = onePasswordErrorDisplay(error);
    if (display == null) {
      return undefined;
    }
    return { field: display.field, message: this.i18nService.t(display.messageKey) };
  }
}

/** What the SDK gets when the user is gone: an enrollment that is called off before it begins. */
const canceledEnrollment: OnePasswordSsoEnrollment = {
  cancelled: () => Promise.resolve(),
  updateStatus: () => Promise.resolve(),
  provideVerificationCode: () => Promise.resolve(undefined),
  endEnrollment: () => Promise.resolve(),
};

/**
 * The enrollment prompt the SDK drives while a device is approved. It opens when the SDK begins the
 * enrollment and stays open until the import is over, so an enrolled device shows the import
 * finishing. The user can call the enrollment off until the verification code is handed over.
 */
class SsoEnrollmentPrompt implements OnePasswordSsoEnrollment {
  private readonly status = signal<OnePasswordSsoEnrollmentStatus>("WaitingForApproval");
  private readonly codeRequested = signal(false);
  private dialog: DialogRef<undefined> | undefined;

  private answerWithCode: (code: string | undefined) => void = () => undefined;
  private cancel: () => void = () => undefined;
  private end: () => void = () => undefined;

  private readonly code = new Promise<string | undefined>(
    (resolve) => (this.answerWithCode = resolve),
  );
  private readonly cancellation = new Promise<void>((resolve) => (this.cancel = resolve));
  private readonly ended = new Promise<void>((resolve) => (this.end = resolve));

  constructor(
    private readonly dialogService: DialogService,
    private readonly email: string,
  ) {}

  open(): this {
    this.dialog = OnePasswordSsoEnrollmentPromptComponent.open(this.dialogService, {
      email: this.email,
      status: this.status,
      codeRequested: this.codeRequested,
      submitCode: (code) => {
        this.answerWithCode(code);
        return this.ended;
      },
    });
    // Closing the prompt calls the enrollment off, unless it is over already, in which case
    // settling the cancellation is what releases it.
    this.dialog.closed.subscribe(() => {
      this.answerWithCode(undefined);
      this.cancel();
    });
    return this;
  }

  close(): void {
    this.end();
    void this.dialog?.close(undefined);
  }

  cancelled(): Promise<void> {
    return this.cancellation;
  }

  updateStatus(status: OnePasswordSsoEnrollmentStatus): Promise<void> {
    this.status.set(status);
    return Promise.resolve();
  }

  provideVerificationCode(): Promise<string | undefined> {
    this.codeRequested.set(true);
    return this.code;
  }

  /** The import goes on after a successful enrollment. Any other result ends it with the prompt. */
  endEnrollment(): Promise<void> {
    return Promise.resolve();
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
