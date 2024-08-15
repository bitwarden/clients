import { Observable, firstValueFrom, switchMap } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";

import {
  GlobalState,
  KeyDefinition,
  LOGIN_EMAIL_DISK,
  LOGIN_EMAIL_MEMORY,
  StateProvider,
} from "../../../../../common/src/platform/state";
import { LoginEmailServiceAbstraction } from "../../abstractions/login-email.service";

export const STORED_EMAIL = new KeyDefinition<string>(LOGIN_EMAIL_DISK, "storedEmail", {
  deserializer: (value: string) => value,
});

export const IN_MEMORY_EMAIL = new KeyDefinition<string>(LOGIN_EMAIL_MEMORY, "tempEmail", {
  deserializer: (value: string) => value,
});

export class LoginEmailService implements LoginEmailServiceAbstraction {
  private email: string | null;
  private rememberEmail: boolean;

  // True if an account is currently being added through account switching
  private readonly addingAccount$: Observable<boolean>;

  private readonly storedEmailState: GlobalState<string>;
  storedEmail$: Observable<string | null>;

  private readonly inMemoryEmailState: GlobalState<string>;
  inMemoryEmail$: Observable<string | null>;

  constructor(
    private accountService: AccountService,
    private authService: AuthService,
    private stateProvider: StateProvider,
  ) {
    this.storedEmailState = this.stateProvider.getGlobal(STORED_EMAIL);
    this.inMemoryEmailState = this.stateProvider.getGlobal(IN_MEMORY_EMAIL);

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

    this.storedEmail$ = this.storedEmailState.state$.pipe(
      switchMap(async (storedEmail) => {
        // When adding an account, we don't show the stored email
        if (await firstValueFrom(this.addingAccount$)) {
          return null;
        }
        return storedEmail;
      }),
    );

    this.inMemoryEmail$ = this.inMemoryEmailState.state$;
  }

  getEmail() {
    return this.email;
  }

  setEmail(email: string) {
    this.email = email;
  }

  async setInMemoryEmail() {
    await this.inMemoryEmailState.update((_) => this.email);
  }

  getRememberEmail() {
    return this.rememberEmail;
  }

  setRememberEmail(value: boolean) {
    this.rememberEmail = value ?? false;
  }

  // Note: only clear values on successful login or you are sure they are not needed.
  // Browser uses these values to maintain the email between login and 2fa components so
  // we do not want to clear them too early.
  clearValues() {
    this.email = null;
    this.rememberEmail = false;
  }

  async saveEmailSettings() {
    const addingAccount = await firstValueFrom(this.addingAccount$);
    await this.storedEmailState.update((storedEmail) => {
      // If we're adding an account, only overwrite the stored email when rememberEmail is true
      if (addingAccount) {
        if (this.rememberEmail) {
          return this.email;
        }
        return storedEmail;
      }

      // Saving with rememberEmail set to false will clear the stored email
      if (this.rememberEmail) {
        return this.email;
      }
      return null;
    });
  }
}
