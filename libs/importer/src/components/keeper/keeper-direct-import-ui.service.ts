import { Injectable, inject, signal } from "@angular/core";

import { ClientType } from "@bitwarden/common/enums";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { DialogRef, DialogService } from "@bitwarden/components";

import {
  Cancel,
  DeviceApprovalChannel,
  DnaMethod,
  DuoMethod,
  PromptForPasswordOptions,
  ProvideApprovalCodeOptions,
  ProvideTwoFactorCodeOptions,
  Resend,
  TryAnother,
  TwoFactorMethod,
  Ui,
} from "../../importers/keeper/access";

import { KeeperAuthDialogComponent } from "./dialog/keeper-auth-dialog.component";
import { KEEPER_SSO_TAB_MONITOR } from "./services/keeper-sso-tab-monitor";

const SSO_CALLBACK_URL_PATTERN =
  /^https:\/\/keepersecurity\.[^/]+\/api\/rest\/sso\/saml\/\d+\/saml\/sso/i;

export type KeeperAuthStage =
  | { kind: "idle" }
  | { kind: "selectApproval"; methods: DeviceApprovalChannel[] }
  | {
      kind: "approvalCode";
      method: DeviceApprovalChannel;
      variant: "email" | "push" | "admin";
      previousCodeRejected: boolean;
    }
  | { kind: "selectTwoFactor"; methods: TwoFactorMethod[] }
  | {
      kind: "twoFactorCode";
      method: TwoFactorMethod;
      needsInput: boolean;
      hidden: boolean;
      canResend: boolean;
      previousCodeRejected: boolean;
    }
  | { kind: "selectDuo"; methods: DuoMethod[]; phoneNumber: string }
  | { kind: "duoPush"; method: DuoMethod }
  | { kind: "selectDna"; methods: DnaMethod[] }
  | { kind: "dnaPush" }
  | { kind: "ssoToken" }
  | { kind: "password"; previousPasswordRejected: boolean }
  | { kind: "error"; message: string };

type PendingResolver = (value: unknown) => void;

@Injectable({
  providedIn: "root",
})
export class KeeperDirectImportUIService implements Ui {
  private readonly dialogService = inject(DialogService);
  private readonly ssoTabMonitor = inject(KEEPER_SSO_TAB_MONITOR);

  // Browser extension auto-captures the SSO token from the callback tab, so
  // the parent import form's submit button (already in a loading state during
  // the async validator) is the only progress indicator the user needs.
  private readonly autoCaptureSsoToken =
    inject(PlatformUtilsService).getClientType() === ClientType.Browser;

  private readonly _stage = signal<KeeperAuthStage>({ kind: "idle" });

  readonly stage = this._stage.asReadonly();

  private readonly _email = signal("");

  readonly email = this._email.asReadonly();

  setEmail(email: string): void {
    this._email.set(email);
  }

  private dialogRef: DialogRef | undefined;

  private setStage(next: KeeperAuthStage): void {
    this._stage.set(next);
    if (next.kind !== "idle" && this.dialogRef === undefined) {
      this.dialogRef = KeeperAuthDialogComponent.open(this.dialogService);
    }
  }

  private pendingResolver: PendingResolver | undefined;

  submit(value: unknown): void {
    this.resolvePending(value);
  }

  cancel(): void {
    this.resolvePending(Cancel);
  }

  resend(): void {
    this.resolvePending(Resend);
  }

  tryAnother(): void {
    this.resolvePending(TryAnother);
  }

  dismissError(): void {
    this.resolvePending(undefined);
  }

  reset(): void {
    this._stage.set({ kind: "idle" });
    this._email.set("");
    void this.dialogRef?.close();
    this.dialogRef = undefined;
  }

  private waitForUser<T>(): Promise<T> {
    return new Promise<T>((resolve) => {
      this.pendingResolver = resolve as PendingResolver;
    });
  }

  private resolvePending(value: unknown): void {
    const resolver = this.pendingResolver;
    this.pendingResolver = undefined;
    resolver?.(value);
  }

  //
  // Device approval flow
  //

  async selectApprovalMethod(
    methods: DeviceApprovalChannel[],
  ): Promise<DeviceApprovalChannel | typeof Cancel> {
    if (methods.length === 0) {
      return Cancel;
    }

    if (methods.length === 1) {
      return methods[0];
    }

    this.setStage({ kind: "selectApproval", methods });
    return this.waitForUser<DeviceApprovalChannel | typeof Cancel>();
  }

  async provideApprovalCode(
    method: DeviceApprovalChannel,
    options?: ProvideApprovalCodeOptions,
  ): Promise<string | typeof Cancel | typeof Resend | typeof TryAnother> {
    const variant: "email" | "push" | "admin" =
      method === DeviceApprovalChannel.Email
        ? "email"
        : method === DeviceApprovalChannel.AdminApproval
          ? "admin"
          : "push";

    this.setStage({
      kind: "approvalCode",
      method,
      variant,
      previousCodeRejected: options?.previousCodeRejected ?? false,
    });
    return this.waitForUser<string | typeof Cancel | typeof Resend | typeof TryAnother>();
  }

  //
  // 2FA flow
  //

  async selectTwoFactorMethod(
    methods: TwoFactorMethod[],
  ): Promise<TwoFactorMethod | typeof Cancel> {
    if (methods.length === 0) {
      return Cancel;
    }

    if (methods.length === 1) {
      return methods[0];
    }

    this.setStage({ kind: "selectTwoFactor", methods });
    return this.waitForUser<TwoFactorMethod | typeof Cancel>();
  }

  async provideTwoFactorCode(
    method: TwoFactorMethod,
    options?: ProvideTwoFactorCodeOptions,
  ): Promise<string | typeof Cancel | typeof Resend | typeof TryAnother> {
    const needsInput =
      method === TwoFactorMethod.Totp ||
      method === TwoFactorMethod.Sms ||
      method === TwoFactorMethod.Duo ||
      method === TwoFactorMethod.Backup ||
      method === TwoFactorMethod.Rsa ||
      method === TwoFactorMethod.KeeperDna;

    this.setStage({
      kind: "twoFactorCode",
      method,
      needsInput,
      hidden: options?.hidden ?? false,
      canResend: options?.canResend ?? false,
      previousCodeRejected: options?.previousCodeRejected ?? false,
    });
    return this.waitForUser<string | typeof Cancel | typeof Resend | typeof TryAnother>();
  }

  //
  // Duo flow
  //

  async selectDuoMethod(
    methods: DuoMethod[],
    phoneNumber: string,
  ): Promise<DuoMethod | typeof Cancel> {
    if (methods.length === 0) {
      return Cancel;
    }

    if (methods.length === 1) {
      return methods[0];
    }

    this.setStage({ kind: "selectDuo", methods, phoneNumber });
    return this.waitForUser<DuoMethod | typeof Cancel>();
  }

  async waitForDuoPush(method: DuoMethod): Promise<typeof Cancel | typeof TryAnother | void> {
    this.setStage({ kind: "duoPush", method });
    const result = await this.waitForUser<unknown>();
    if (result === Cancel || result === TryAnother) {
      return result;
    }
  }

  //
  // Keeper DNA flow
  //

  async selectDnaMethod(methods: DnaMethod[]): Promise<DnaMethod | typeof Cancel> {
    if (methods.length === 0) {
      return Cancel;
    }

    if (methods.length === 1) {
      return methods[0];
    }

    this.setStage({ kind: "selectDna", methods });
    return this.waitForUser<DnaMethod | typeof Cancel>();
  }

  async waitForDnaPush(): Promise<typeof Cancel | typeof TryAnother | void> {
    this.setStage({ kind: "dnaPush" });
    const result = await this.waitForUser<unknown>();
    if (result === Cancel || result === TryAnother) {
      return result;
    }
  }

  //
  // Cloud SSO flow
  //

  async ssoLogin(url: string): Promise<string | typeof Cancel> {
    // Browser extension: skip the dialog entirely — the Import button's
    // loading state covers the wait, and the tab monitor delivers the token.
    if (this.autoCaptureSsoToken) {
      try {
        return await this.ssoTabMonitor.launchAndWaitForToken(url, SSO_CALLBACK_URL_PATTERN);
      } finally {
        this.ssoTabMonitor.cancel();
      }
    }

    // Desktop / web: open the IdP and let the user paste the token back.
    this.setStage({ kind: "ssoToken" });
    void this.ssoTabMonitor
      .launchAndWaitForToken(url, SSO_CALLBACK_URL_PATTERN)
      .catch((): void => undefined);

    try {
      return await this.waitForUser<string | typeof Cancel>();
    } finally {
      this.ssoTabMonitor.cancel();
    }
  }

  //
  // Password prompt
  //

  async promptForPassword(options?: PromptForPasswordOptions): Promise<string | typeof Cancel> {
    this.setStage({
      kind: "password",
      previousPasswordRejected: options?.previousPasswordRejected ?? false,
    });
    return this.waitForUser<string | typeof Cancel>();
  }

  //
  // Error display
  //

  async showError(message: string): Promise<void> {
    this.setStage({ kind: "error", message });
    await this.waitForUser<unknown>();
  }
}
