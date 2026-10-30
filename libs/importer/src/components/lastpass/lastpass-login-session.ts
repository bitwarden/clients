import { Ui } from "../../importers/lastpass/access/ui";

/** What the inline login card gives `LastPassDirectImportService` in place of its dialogs. */
export interface LastPassLoginSession extends Ui {
  /** True once the user left mid-login, so the resulting cancellation isn't shown as an error. */
  readonly userLeft: boolean;

  /** Rejects if the user leaves. */
  promptForPassword(options: { previousPasswordRejected: boolean }): Promise<string>;

  /** True, and the next code prompt shows LastPass rejected the code, only if the user submitted
   *  a code since the last prompt. A failure with no typed code behind it (a declined or expired
   *  push) isn't a rejected code. */
  rejectSubmittedCode(): boolean;

  /** Call before opening the SSO tab. */
  prepareSso(): Promise<void>;

  /** Shows the SSO waiting card. Rejects if the user leaves. */
  waitForSsoCancel(): Promise<never>;

  /** The SSO callback arrived. */
  completeSso(): void;
}
