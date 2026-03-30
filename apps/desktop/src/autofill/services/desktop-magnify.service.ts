import { Injectable, OnDestroy } from "@angular/core";
import {
  combineLatest,
  concatMap,
  distinctUntilChanged,
  map,
  Observable,
  of,
  Subject,
  takeUntil,
} from "rxjs";

import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import {
  ActiveUserStateProvider,
  MAGNIFY_SETTINGS_DISK,
  UserKeyDefinition,
} from "@bitwarden/common/platform/state";

import { MagnifyCommand, MagnifyCommandResponse } from "../models/magnify-commands";

export const MAGNIFY_ENABLED = new UserKeyDefinition<boolean | null>(
  MAGNIFY_SETTINGS_DISK,
  "magnifyEnabled",
  {
    deserializer: (value: boolean | null) => !!value,
    clearOn: [],
  },
);

export type Result<T, E = Error> = [E, null] | [null, T];

@Injectable({
  providedIn: "root",
})
export class DesktopMagnifyService implements OnDestroy {
  private readonly magnifyEnabledState = this.activeUserStateProvider.get(MAGNIFY_ENABLED);

  // The enabled/disabled state from the user settings menu
  magnifyEnabledUserSetting$: Observable<boolean> = of(false);

  // Magnify is only active when the user has the setting enabled and the vault is unlocked
  private magnifyFeatureEnabled$: Observable<boolean> = of(false);

  private destroy$ = new Subject<void>();

  constructor(
    private activeUserStateProvider: ActiveUserStateProvider,
    private authService: AuthService,
  ) {
    this.magnifyEnabledUserSetting$ = this.magnifyEnabledState.state$.pipe(
      map((enabled) => enabled ?? false),
      distinctUntilChanged(),
      takeUntil(this.destroy$),
    );

    this.magnifyFeatureEnabled$ = combineLatest([
      this.magnifyEnabledUserSetting$,
      this.authService.activeAccountStatus$,
    ]).pipe(
      map(
        ([settingEnabled, authStatus]) =>
          settingEnabled && authStatus === AuthenticationStatus.Unlocked,
      ),
      distinctUntilChanged(),
      takeUntil(this.destroy$),
    );
  }

  async init() {
    this.magnifyFeatureEnabled$
      .pipe(
        concatMap(async (enabled) => {
          ipc.autofill.toggleMagnify(enabled);
        }),
        takeUntil(this.destroy$),
      )
      .subscribe();

    ipc.autofill.listenMagnifyCommand(async (request, callback) => {
      switch (request.type) {
        case MagnifyCommand.SearchVault: {
          const [error, result] = await this.searchVault(request.input);
          callback(error, result);
          break;
        }

        case MagnifyCommand.CopyPassword: {
          const [error, result] = await this.copyPassword(request.id);
          callback(error, result);
          break;
        }
      }
    });
  }

  async setMagnifyEnabledState(enabled: boolean): Promise<void> {
    await this.magnifyEnabledState.update(() => enabled, {
      shouldUpdate: (currentlyEnabled) => currentlyEnabled !== enabled,
    });
  }

  /*
    This function searches the vault using an input string
    and returns the relevant MagnifyCommandResponse. This is based
    on the searchVault Magnify Command.

    Check the getAutotypeVaultData() fn in:
    apps/desktop/src/autofill/services/desktop-autotype.service.ts
    for examples of returning this Result type.
  */
  private async searchVault(input: string): Promise<Result<MagnifyCommandResponse>> {
    // Returning dummy data for now
    // TODO: IMPLEMENT ACTUAL VAULT SEARCH HERE
    const response: MagnifyCommandResponse = {
      type: MagnifyCommand.SearchVault,
      results: [
        { id: "a1b2c3", name: "Netflix", username: "user@gmail.com" },
        { id: "d4e5f6", name: "Netflix Family", username: "family@gmail.com" },
        { id: "g7h8i9", name: "Netflix Work", username: "user@company.com" },
      ],
    };

    return [null, response];
  }

  /*
    This function returns the password for a specific Login cipher
    based on the copyPassword Magnify Command.

    Check the getAutotypeVaultData() fn in:
    apps/desktop/src/autofill/services/desktop-autotype.service.ts
    for examples of returning this Result type.

  */
  private async copyPassword(id: string): Promise<Result<MagnifyCommandResponse>> {
    // Returning dummy data for now
    // TODO: IMPLEMENT ACTUAL COPY PASSWORD LOGIC HERE
    const response: MagnifyCommandResponse = {
      type: MagnifyCommand.CopyPassword,
      result: "PasswordIsHere!",
    };

    return [null, response];
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
