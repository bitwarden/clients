import { Observable } from "rxjs";

export abstract class LoginEmailServiceAbstraction {
  /**
   * An observable that monitors the loginEmail.
   * The loginEmail is the email that is being used in the current login process.
   */
  loginEmail$: Observable<string | null>;
  /**
   * An observable that monitors the remembered email.
   * This will return null if an account is being added.
   */
  rememberedEmail$: Observable<string | null>;
  /**
   * Sets the loginEmail in memory.
   * The loginEmail is the email that is being used in the current login process.
   * Consumed through `loginEmail$` observable.
   */
  setLoginEmail: (email: string) => Promise<void>;
  /**
   * Persist the user's choice of whether to remember their email on subsequent login attempts.
   * Consumed through `rememberedEmail$` observable.
   */
  setRememberedEmailChoice: (email: string, remember: boolean) => Promise<void>;
  /**
   * Clears the in-progress login email, to be used after a successful login.
   */
  clearLoginEmail: () => Promise<void>;
}
