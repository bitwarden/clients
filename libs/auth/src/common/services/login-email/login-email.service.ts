import { Observable, firstValueFrom, switchMap } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";

// FIXME: remove `src` and fix import
// eslint-disable-next-line no-restricted-imports
import {
  GlobalState,
  KeyDefinition,
  LOGIN_EMAIL_DISK,
  LOGIN_EMAIL_MEMORY,
  StateProvider,
} from "../../../../../common/src/platform/state";
import { LoginEmailServiceAbstraction } from "../../abstractions/login-email.service";

export const LOGIN_EMAIL = new KeyDefinition<string>(LOGIN_EMAIL_MEMORY, "loginEmail", {
  deserializer: (value: string) => value,
});

export const STORED_EMAIL = new KeyDefinition<string>(LOGIN_EMAIL_DISK, "storedEmail", {
  deserializer: (value: string) => value,
});

export class LoginEmailService implements LoginEmailServiceAbstraction {
  // True if an account is currently being added through account switching
  private readonly addingAccount$: Observable<boolean>;

  private readonly loginEmailState: GlobalState<string>;
  loginEmail$: Observable<string | null>;

  private readonly storedEmailState: GlobalState<string>;
  rememberedEmail$: Observable<string | null>;

  constructor(
    private accountService: AccountService,
    private authService: AuthService,
    private stateProvider: StateProvider,
  ) {
    this.loginEmailState = this.stateProvider.getGlobal(LOGIN_EMAIL);
    this.storedEmailState = this.stateProvider.getGlobal(STORED_EMAIL);

    // In order to determine if an account is being added, we check if any account is not logged out
    this.addingAccount$ = this.authService.authStatuses$.pipe(
      switchMap(async (statuses) => {
        // We don't want to consider the active account since it may have just changed auth status to logged in
        // which would make this observable think an account is being added
        const activeUser = await firstValueFrom(this.accountService.activeAccount$);
        if (activeUser) {
          delete statuses[activeUser.id];
        }
        return Object.values(statuses).some((status) => status !== AuthenticationStatus.LoggedOut);
      }),
    );

    this.loginEmail$ = this.loginEmailState.state$;

    this.rememberedEmail$ = this.storedEmailState.state$.pipe(
      switchMap(async (storedEmail) => {
        // When adding an account, we don't show the stored email
        if (await firstValueFrom(this.addingAccount$)) {
          return null;
        }
        return storedEmail;
      }),
    );
  }

  /** Sets the login email in memory.
   * The login email is the email that is being used in the current login process.
   */
  async setLoginEmail(email: string) {
    await this.loginEmailState.update((_) => email);
  }

  /**
   * Clears the in-progress login email from state.
   * Note: Only clear on successful login or you are sure they are not needed.
   * The extension client uses these values to maintain the email between login and 2fa components so
   * we do not want to clear them too early.
   */
  async clearLoginEmail() {
    await this.loginEmailState.update((_) => null);
  }

  async setRememberedEmailChoice(email: string, remember: boolean): Promise<void> {
    if (remember) {
      await this.storedEmailState.update((_) => email);
    } else {
      await this.storedEmailState.update((_) => null);
    }
  }

  async clearRememberedEmail(): Promise<void> {
    await this.storedEmailState.update((_) => null);
  }
}
