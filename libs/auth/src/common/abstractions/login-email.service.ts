// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Observable } from "rxjs";

export abstract class LoginEmailServiceAbstraction {
  /**
   * An observable that monitors the loginEmail in memory.
   * The loginEmail is the email that is being used in the current login process.
   */
  loginEmail$: Observable<string | null>;
  /**
   * An observable that monitors the storedEmail on disk.
   * This will return null if an account is being added.
   */
  storedEmail$: Observable<string | null>;
  /**
   * Sets the loginEmail in memory.
   * The loginEmail is the email that is being used in the current login process.
   */
  setLoginEmail: (email: string) => Promise<void>;
  /**
   * Gets from memory whether or not the email should be stored on disk when `saveEmailSettings` is called.
   * @returns A boolean stating whether or not the email should be stored on disk.
   */
  getRememberEmail: () => boolean;
  /**
   * Sets in memory whether or not the email should be stored on disk when `saveEmailSettings` is called.
   */
  setRememberEmail: (value: boolean) => void;
  /**
   * Sets the email and rememberEmail properties in memory to null.
   */
  clearValues: () => void;
  /**
   * Saves or clears the email on disk
   * - If an account is being added, only changes the stored email when rememberEmail is true.
   * - If rememberEmail is true, sets the email on disk to the current email.
   * - If rememberEmail is false, sets the email on disk to null.
   * Always clears the email and rememberEmail properties from memory.
   * @returns A promise that resolves once the email settings are saved.
   */
  saveEmailSettings: () => Promise<void>;
}
