import { OobResult, OtpResult } from "../../../../importers/lastpass/access/models";
import { LastPassImportPageFocus } from "../../../lastpass/lastpass-import-page-focus";
import { LastPassLoginSession } from "../../../lastpass/lastpass-login-session";

/** `loading`: a request is in flight. `importing`: the login is done and the vault is being
 *  written, which can't be cancelled. */
export type LastPassInlineStage =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "password"; previousPasswordRejected: boolean }
  | { kind: "code"; previousCodeRejected: boolean }
  | { kind: "sso" }
  | { kind: "importing" };

type PendingAnswer = { submit: (value: string) => void; cancel: () => void; isCode: boolean };

/** One LastPass login's conversation with the user. Keeping the state per login means a cancelled
 *  login that is still unwinding can never prompt inside a login started after it. */
export class LastPassAuthSession implements LastPassLoginSession {
  private pending: PendingAnswer | undefined;
  private rejectSsoWait: ((error: Error) => void) | undefined;
  private codeRejected = false;
  private codeSubmitted = false;
  private _userLeft = false;

  constructor(
    private readonly show: (session: LastPassAuthSession, stage: LastPassInlineStage) => void,
    private readonly pageFocus: LastPassImportPageFocus,
  ) {}

  get userLeft(): boolean {
    return this._userLeft;
  }

  /** Cancels the login from wherever it is: the open prompt or the SSO wait. */
  leave(): void {
    this._userLeft = true;
    this.cancelPending();
    this.rejectSsoWait?.(new Error("SSO auth cancelled"));
    this.rejectSsoWait = undefined;
  }

  /** Past the point of cancelling: leaving now can't stop the import already being written. */
  beginImport(): void {
    this.show(this, { kind: "importing" });
  }

  submit(value: string): void {
    const pending = this.pending;
    if (pending === undefined) {
      return;
    }
    this.pending = undefined;
    if (pending.isCode) {
      this.codeSubmitted = true;
    }
    this.show(this, { kind: "loading" });
    pending.submit(value);
  }

  rejectSubmittedCode(): boolean {
    if (!this.codeSubmitted) {
      return false;
    }
    this.codeSubmitted = false;
    this.codeRejected = true;
    return true;
  }

  promptForPassword(options: { previousPasswordRejected: boolean }): Promise<string> {
    if (this._userLeft) {
      return Promise.reject(new Error("Login cancelled by the user"));
    }
    return new Promise<string>((resolve, reject) => {
      this.pending = {
        submit: resolve,
        cancel: () => reject(new Error("Login cancelled by the user")),
        isCode: false,
      };
      this.show(this, {
        kind: "password",
        previousPasswordRejected: options.previousPasswordRejected,
      });
    });
  }

  async provideGoogleAuthPasscode(): Promise<OtpResult> {
    return this.askForOtp();
  }

  async provideMicrosoftAuthPasscode(): Promise<OtpResult> {
    return this.askForOtp();
  }

  async provideYubikeyPasscode(): Promise<OtpResult> {
    return this.askForOtp();
  }

  async approveLastPassAuth(): Promise<OobResult> {
    return this.askForOobPasscode();
  }

  async approveDuo(): Promise<OobResult> {
    return this.askForOobPasscode();
  }

  async approveSalesforceAuth(): Promise<OobResult> {
    return this.askForOobPasscode();
  }

  /** The library calls this once an out-of-band login ends, whether the user approved it in the
   *  app or entered the code, so the code prompt must not outlive it. */
  closeMFADialog(): void {
    if (this._userLeft) {
      return;
    }
    this.cancelPending();
    this.show(this, { kind: "loading" });
  }

  async prepareSso(): Promise<void> {
    await this.pageFocus.capture();
  }

  waitForSsoCancel(): Promise<never> {
    if (this._userLeft) {
      return Promise.reject(new Error("SSO auth cancelled"));
    }
    return new Promise<never>((_, reject) => {
      this.rejectSsoWait = reject;
      this.show(this, { kind: "sso" });
    });
  }

  completeSso(): void {
    this.rejectSsoWait = undefined;
    this.pageFocus.restore();
    this.show(this, { kind: "loading" });
  }

  private askForOtp(): Promise<OtpResult> {
    if (this._userLeft) {
      return Promise.resolve(OtpResult.cancel);
    }
    return new Promise<OtpResult>((resolve) => {
      this.pending = {
        submit: (passcode) => resolve(new OtpResult(passcode, false)),
        cancel: () => resolve(OtpResult.cancel),
        isCode: true,
      };
      this.showCode();
    });
  }

  private askForOobPasscode(): Promise<OobResult> {
    if (this._userLeft) {
      return Promise.resolve(OobResult.cancel);
    }
    return new Promise<OobResult>((resolve) => {
      this.pending = {
        submit: (passcode) => resolve(new OobResult(false, passcode, false)),
        cancel: () => resolve(OobResult.cancel),
        isCode: true,
      };
      this.showCode();
    });
  }

  private showCode(): void {
    const previousCodeRejected = this.codeRejected;
    this.codeRejected = false;
    this.codeSubmitted = false;
    this.show(this, { kind: "code", previousCodeRejected });
  }

  private cancelPending(): void {
    const pending = this.pending;
    this.pending = undefined;
    pending?.cancel();
  }
}
