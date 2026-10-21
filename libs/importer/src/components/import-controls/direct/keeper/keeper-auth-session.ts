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
} from "../../../../importers/keeper/access";
import { KeeperAuthStage } from "../../../keeper/keeper-direct-import-ui.service";
import { KeeperSsoTabMonitor } from "../../../keeper/services/keeper-sso-tab-monitor";

/** `loading`: a request is in flight, or the browser extension is waiting on the SSO tab.
 *  `importing`: the login is done and the vault is being written, which can't be cancelled. */
export type KeeperInlineStage =
  Exclude<KeeperAuthStage, { kind: "error" }> | { kind: "loading" } | { kind: "importing" };

type PendingResolver = (value: unknown) => void;

/** One Keeper login's conversation with the user. Keeping the state per login means a cancelled
 *  login that is still unwinding can never prompt inside a login started after it.
 */
export class KeeperAuthSession implements Ui {
  private pendingResolver: PendingResolver | undefined;
  private _userLeft = false;
  private _errorReported = false;
  private dnaChosen = false;

  constructor(
    private readonly show: (session: KeeperAuthSession, stage: KeeperInlineStage) => void,
    private readonly ssoTabMonitor: KeeperSsoTabMonitor,
    private readonly autoCaptureSsoToken: boolean,
    private readonly reportError: (session: KeeperAuthSession, message: string) => void,
  ) {}

  /** True once the user left mid-login, so the resulting cancellation isn't shown as an error. */
  get userLeft(): boolean {
    return this._userLeft;
  }

  /** True once the card has shown this login's failure itself, so it needs no second message. */
  get errorReported(): boolean {
    return this._errorReported;
  }

  /** Cancels the login from wherever it is: the open prompt, the SSO tab, or the next prompt. */
  leave(): void {
    this._userLeft = true;
    this.ssoTabMonitor.cancel();
    this.resolvePending(Cancel);
  }

  /** Past the point of cancelling: leaving now can't stop the import already being written. */
  beginImport(): void {
    this.show(this, { kind: "importing" });
  }

  submit(value: unknown): void {
    if (this.pendingResolver === undefined) {
      return;
    }
    this.show(this, { kind: "loading" });
    this.resolvePending(value);
  }

  resend(): void {
    this.resolvePending(Resend);
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
    if (this._userLeft || methods.length === 0) {
      return Cancel;
    }
    if (methods.length === 1) {
      return this.toClientChannel(methods[0]);
    }
    this.show(this, { kind: "selectApproval", methods });
    return this.toClientChannel(await this.waitForUser<DeviceApprovalChannel | typeof Cancel>());
  }

  private toClientChannel<T>(choice: T | DeviceApprovalChannel): T | DeviceApprovalChannel {
    this.dnaChosen = choice === DeviceApprovalChannel.KeeperDna;
    return this.dnaChosen ? DeviceApprovalChannel.TwoFactor : choice;
  }

  async provideApprovalCode(
    method: DeviceApprovalChannel,
    options?: ProvideApprovalCodeOptions,
  ): Promise<string | typeof Cancel | typeof Resend | typeof TryAnother> {
    if (this._userLeft) {
      return Cancel;
    }
    const variant: "email" | "push" | "admin" =
      method === DeviceApprovalChannel.Email
        ? "email"
        : method === DeviceApprovalChannel.AdminApproval
          ? "admin"
          : "push";

    this.show(this, {
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
    if (this._userLeft || methods.length === 0) {
      return Cancel;
    }
    if (methods.length === 1) {
      return methods[0];
    }
    this.show(this, { kind: "selectTwoFactor", methods });
    return this.waitForUser<TwoFactorMethod | typeof Cancel>();
  }

  async provideTwoFactorCode(
    method: TwoFactorMethod,
    options?: ProvideTwoFactorCodeOptions,
  ): Promise<string | typeof Cancel | typeof Resend | typeof TryAnother> {
    if (this._userLeft) {
      return Cancel;
    }
    if (this.dnaChosen && options?.hidden) {
      this.show(this, { kind: "dnaPush" });
      return this.waitForUser<string | typeof Cancel | typeof Resend | typeof TryAnother>();
    }
    const needsInput =
      method === TwoFactorMethod.Totp ||
      method === TwoFactorMethod.Sms ||
      method === TwoFactorMethod.Duo ||
      method === TwoFactorMethod.Backup ||
      method === TwoFactorMethod.Rsa ||
      method === TwoFactorMethod.KeeperDna;

    this.show(this, {
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
    if (this._userLeft || methods.length === 0) {
      return Cancel;
    }
    if (methods.length === 1) {
      return methods[0];
    }
    this.show(this, { kind: "selectDuo", methods, phoneNumber });
    return this.waitForUser<DuoMethod | typeof Cancel>();
  }

  async waitForDuoPush(method: DuoMethod): Promise<typeof Cancel | typeof TryAnother | void> {
    if (this._userLeft) {
      return Cancel;
    }
    this.show(this, { kind: "duoPush", method });
    const result = await this.waitForUser<unknown>();
    if (result === Cancel || result === TryAnother) {
      return result;
    }
  }

  //
  // Keeper DNA flow
  //

  async selectDnaMethod(methods: DnaMethod[]): Promise<DnaMethod | typeof Cancel> {
    if (this._userLeft || methods.length === 0) {
      return Cancel;
    }
    if (methods.length === 1) {
      return methods[0];
    }
    this.show(this, { kind: "selectDna", methods });
    return this.waitForUser<DnaMethod | typeof Cancel>();
  }

  async waitForDnaPush(): Promise<typeof Cancel | typeof TryAnother | void> {
    if (this._userLeft) {
      return Cancel;
    }
    this.show(this, { kind: "dnaPush" });
    const result = await this.waitForUser<unknown>();
    if (result === Cancel || result === TryAnother) {
      return result;
    }
  }

  //
  // Cloud SSO flow
  //

  async ssoLogin(url: string): Promise<string | typeof Cancel> {
    if (this._userLeft) {
      return Cancel;
    }

    if (this.autoCaptureSsoToken) {
      this.show(this, { kind: "loading" });
      // The monitor's wait doesn't end when cancelled, so leaving has to end it.
      const left = this.waitForUser<typeof Cancel>();
      try {
        return await Promise.race([this.ssoTabMonitor.launchAndWaitForToken(url), left]);
      } finally {
        this.pendingResolver = undefined;
        this.ssoTabMonitor.cancel();
      }
    }

    this.show(this, { kind: "ssoToken" });
    void this.ssoTabMonitor.launchAndWaitForToken(url).catch((): void => undefined);

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
    if (this._userLeft) {
      return Cancel;
    }
    this.show(this, {
      kind: "password",
      previousPasswordRejected: options?.previousPasswordRejected ?? false,
    });
    return this.waitForUser<string | typeof Cancel>();
  }

  //
  // Error display
  //

  async showError(message: string): Promise<void> {
    if (this._userLeft) {
      return;
    }
    this._errorReported = true;
    this.reportError(this, message);
  }
}
