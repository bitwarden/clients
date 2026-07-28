import { Injectable, OnDestroy } from "@angular/core";
import {
  combineLatest,
  concatMap,
  distinctUntilChanged,
  filter,
  firstValueFrom,
  map,
  Observable,
  of,
  Subject,
  switchMap,
  takeUntil,
} from "rxjs";

import { Account, AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { BillingAccountProfileStateService } from "@bitwarden/common/billing/abstractions";
import { DeviceType } from "@bitwarden/common/enums";
import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import {
  GlobalStateProvider,
  AUTOTYPE_SETTINGS_DISK,
  KeyDefinition,
} from "@bitwarden/common/platform/state";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import { LogService } from "@bitwarden/logging";
import { UserId } from "@bitwarden/user-core";

import { AutotypeConfig } from "../models/autotype-config";
import { AutotypeState } from "../models/autotype-state";
import { AutotypeVaultData } from "../models/autotype-vault-data";
import { DEFAULT_KEYBOARD_SHORTCUT } from "../models/main-autotype-keyboard-shortcut";

import { DesktopAutotypeDefaultSettingPolicy } from "./desktop-autotype-policy.service";

// Holds the stored user setting if Autotype is enabled or not. Possible values:
//   true  - autotype was set to true in the desktop settings
//   false - autotype was set to false in the desktop settings
//   null  - the autotype setting has not been touched
export const AUTOTYPE_ENABLED = new KeyDefinition<boolean | null>(
  AUTOTYPE_SETTINGS_DISK,
  "autotypeEnabled",
  { deserializer: (b) => b },
);

/*
  Valid windows shortcut keys: Control, Alt, Super, Shift, letters A - Z
  Valid macOS shortcut keys: Control, Alt, Command, Shift, letters A - Z

  See Electron keyboard shortcut docs for more info:
  https://www.electronjs.org/docs/latest/tutorial/keyboard-shortcuts
*/
export const AUTOTYPE_KEYBOARD_SHORTCUT = new KeyDefinition<string[]>(
  AUTOTYPE_SETTINGS_DISK,
  "autotypeKeyboardShortcut",
  { deserializer: (b) => b },
);

export type Result<T, E = Error> = [E, null] | [null, T];

@Injectable({
  providedIn: "root",
})
export class DesktopAutotypeService implements OnDestroy {
  // The user autotypeEnabled setting state
  private readonly autotypeEnabledState = this.globalStateProvider.get(AUTOTYPE_ENABLED);

  // The set of keys to activate autotype
  private readonly autotypeKeyboardShortcut = this.globalStateProvider.get(
    AUTOTYPE_KEYBOARD_SHORTCUT,
  );

  // The observable for the enabled/disabled state from the user settings menu
  autotypeEnabledUserSetting$: Observable<boolean> = of(false);

  // The observable for the set of keys to activate autotype
  autotypeKeyboardShortcut$: Observable<string[]> = of(DEFAULT_KEYBOARD_SHORTCUT);

  // If the user's account is Premium
  private readonly isPremiumAccount$: Observable<boolean>;

  private destroy$ = new Subject<void>();

  constructor(
    private accountService: AccountService,
    private authService: AuthService,
    private cipherService: CipherService,
    private configService: ConfigService,
    private globalStateProvider: GlobalStateProvider,
    private platformUtilsService: PlatformUtilsService,
    private billingAccountProfileStateService: BillingAccountProfileStateService,
    private desktopAutotypePolicy: DesktopAutotypeDefaultSettingPolicy,
    private logService: LogService,
  ) {
    this.autotypeEnabledUserSetting$ = this.autotypeEnabledState.state$.pipe(
      map((enabled) => enabled ?? false),
      distinctUntilChanged(), // Only emit when the boolean result changes
      takeUntil(this.destroy$),
    );

    this.isPremiumAccount$ = this.accountService.activeAccount$.pipe(
      filter((account): account is Account => !!account),
      switchMap((account) =>
        this.billingAccountProfileStateService.hasPremiumFromAnySource$(account.id),
      ),
      distinctUntilChanged(), // Only emit when the boolean result changes
      takeUntil(this.destroy$),
    );

    this.autotypeKeyboardShortcut$ = this.autotypeKeyboardShortcut.state$.pipe(
      map((shortcut) => shortcut ?? DEFAULT_KEYBOARD_SHORTCUT),
      takeUntil(this.destroy$),
    );
  }

  async init() {
    // Currently Autotype is only supported for Windows
    if (this.platformUtilsService.getDevice() !== DeviceType.WindowsDesktop) {
      return;
    }

    // Turns on the local autotype setting, if `autotypeDefaultPolicy` is `true`
    // for a user's organization, and the user has never changed their local
    // autotype setting (`autotypeEnabledState`).
    //
    // We do this by setting their local setting to `true`. Once the local user
    // setting is changed by this policy or the user themselves, the default
    // policy should never change the user setting again.
    combineLatest([
      this.autotypeEnabledState.state$,
      this.desktopAutotypePolicy.autotypeDefaultSetting$,
    ])
      .pipe(
        concatMap(async ([autotypeEnabledState, autotypeDefaultPolicy]) => {
          try {
            if (autotypeDefaultPolicy === true && autotypeEnabledState === null) {
              await this.setAutotypeEnabledState(true);
            }
          } catch {
            this.logService.error("Failed to set Autotype enabled state.");
          }
        }),
        takeUntil(this.destroy$),
      )
      .subscribe();

    // Listen for changes in keyboard shortcut settings
    this.autotypeKeyboardShortcut$
      .pipe(
        concatMap(async (keyboardShortcut) => {
          const config: AutotypeConfig = {
            keyboardShortcut,
          };
          ipc.autofill.configureAutotypeMvp(config);
        }),
        takeUntil(this.destroy$),
      )
      .subscribe();

    // Subscribes to any changes to the Autotype state,
    // doing one of the following:
    //   - Enables the Autotype MVP implementation
    //   - Enables the Autotype GA implementation
    //   - Disables Autotype
    //
    // Note: delete MVP related code with PM-41067
    this.autotypeState$
      .pipe(
        concatMap(async (state) => {
          // Currently, only the MVP implementation is wired up
          // TODO: Wire up GA, in the follow-up PR
          switch (state) {
            case AutotypeState.Mvp: {
              // TODO: toggle off GA, and stop any GA listeners, in the follow-up PR

              // Define the function called within listenAutotypeRequestMvp()
              // in the preload.ts file for the Autotype MVP implementation
              ipc.autofill.listenAutotypeRequestMvp(async (windowTitle, callback) => {
                const possibleCiphers = await this.matchCiphersToWindowTitle(windowTitle);
                const firstCipher = possibleCiphers?.at(0);
                const [error, vaultData] = getAutotypeVaultData(firstCipher);
                callback(error, vaultData);
              });

              ipc.autofill.toggleAutotypeMvp(true);

              break;
            }
            case AutotypeState.Ga: {
              ipc.autofill.stopListeningAutotypeRequestMvp();
              ipc.autofill.toggleAutotypeMvp(false);

              // TODO: enable GA, and start the GA listener, in the follow-up PR

              break;
            }
            case AutotypeState.Disabled: {
              ipc.autofill.stopListeningAutotypeRequestMvp();
              ipc.autofill.toggleAutotypeMvp(false);

              // TODO: disable GA and stop the GA listener, in the follow-up PR

              break;
            }
            default: {
              // We should not reach this, but disable both MVP & GA
              // for any unrecognized future state.

              ipc.autofill.stopListeningAutotypeRequestMvp();
              ipc.autofill.toggleAutotypeMvp(false);

              // TODO: disable GA and stop the GA listener, in the follow-up PR

              // Compile-time exhaustiveness check.
              // Fails to build if AutotypeState ever gains a member not handled above.
              const _exhaustive: never = state;
              this.logService.error(
                `Unhandled AutotypeState member, failed closed: ${_exhaustive}`,
              );

              break;
            }
          }
        }),
        takeUntil(this.destroy$),
      )
      .subscribe();
  }

  // Returns an observable that represents which Autotype implementation, if any,
  // is active for the current user.
  private get autotypeState$(): Observable<AutotypeState> {
    return combineLatest([
      // if the user has enabled the setting
      this.autotypeEnabledUserSetting$,
      // if the MVP and/or GA feature flags are set
      autotypeFeatureFlags$(this.configService),
      // if there is an active account with an unlocked vault
      this.authService.activeAccountStatus$,
      // if the active user's account is Premium
      this.isPremiumAccount$,
    ]).pipe(
      map(([settingsEnabled, [mvpFlagEnabled, gaFlagEnabled], authStatus, isPremiumAcct]) => {
        // Base condition for any non-disabled state: the user setting is on, the vault
        // is unlocked, and the account is Premium.
        const baseCondition =
          settingsEnabled && authStatus === AuthenticationStatus.Unlocked && isPremiumAcct;

        if (!baseCondition) {
          return AutotypeState.Disabled;
        }

        // MVP intentionally takes precedence over GA when both flags are enabled
        // simultaneously.
        if (mvpFlagEnabled) {
          return AutotypeState.Mvp;
        }

        if (gaFlagEnabled) {
          return AutotypeState.Ga;
        }

        return AutotypeState.Disabled;
      }),
      distinctUntilChanged(), // Only emit when the resolved state changes
      takeUntil(this.destroy$),
    );
  }

  async setAutotypeEnabledState(enabled: boolean): Promise<void> {
    await this.autotypeEnabledState.update(() => enabled, {
      shouldUpdate: (currentlyEnabled) => currentlyEnabled !== enabled,
    });
  }

  async setAutotypeKeyboardShortcutState(keyboardShortcut: string[]): Promise<void> {
    await this.autotypeKeyboardShortcut.update(() => keyboardShortcut);
  }

  async matchCiphersToWindowTitle(windowTitle: string): Promise<CipherView[]> {
    const URI_PREFIX = "apptitle://";
    windowTitle = windowTitle.toLowerCase();

    const ciphers = await firstValueFrom(
      this.accountService.activeAccount$.pipe(
        map((account) => account?.id),
        filter((userId): userId is UserId => userId != null),
        switchMap((userId) => this.cipherService.cipherViews$(userId)),
      ),
    );

    const possibleCiphers = ciphers.filter((c) => {
      return (
        c.login?.username &&
        c.login?.password &&
        c.deletedDate == null &&
        c.login?.uris.some((u) => {
          if (u.uri?.indexOf(URI_PREFIX) !== 0) {
            return false;
          }

          const uri = u.uri.substring(URI_PREFIX.length).toLowerCase();

          return windowTitle.indexOf(uri) > -1;
        })
      );
    });

    return possibleCiphers;
  }

  ngOnDestroy() {
    ipc.autofill.stopListeningAutotypeRequestMvp();
    // TODO: stop the GA listener, in the follow-up PR
    this.destroy$.next();
    this.destroy$.complete();
  }
}

// Combines the MVP and GA feature flags into a single observable so the feature flags
// are only subscribed to in one location.
//
// `autotypeState$` and `autotypeMvpOrGaEnabled$` both consume this.
function autotypeFeatureFlags$(configService: ConfigService): Observable<[boolean, boolean]> {
  return combineLatest([
    configService.getFeatureFlag$(FeatureFlag.WindowsDesktopAutotype), // mvp
    configService.getFeatureFlag$(FeatureFlag.WindowsDesktopAutotypeGA), // ga
  ]);
}

/**
 * Emits true when either the MVP or GA Autotype implementation is feature-flagged on,
 * independent of user setting, premium status, or lock state. Consumers that only care
 * "is some Autotype implementation available" (Settings UI visibility, the org
 * default-enable policy) should use this instead of checking a single flag directly --
 * `DesktopAutotypeService.autotypeState$` is the only place that needs the two flags
 * individually, to decide MVP-vs-GA precedence.
 */
export function autotypeMvpOrGaEnabled$(configService: ConfigService): Observable<boolean> {
  return autotypeFeatureFlags$(configService).pipe(
    map(([mvpEnabled, gaEnabled]) => mvpEnabled || gaEnabled),
    // Consumers feed this into a switchMap chain or a signal.set(), so suppressing
    // no-op re-emissions avoids restarting downstream subscriptions or triggering
    // unnecessary change detection.
    distinctUntilChanged(),
  );
}

/**
 * @return an `AutotypeVaultData` object or an `Error` if the
 * cipher or vault data within are undefined.
 */
export function getAutotypeVaultData(
  cipherView: CipherView | undefined,
): Result<AutotypeVaultData> {
  if (!cipherView) {
    return [Error("No matching vault item."), null];
  } else if (cipherView.login.username === undefined || cipherView.login.password === undefined) {
    return [Error("Vault item is undefined."), null];
  } else {
    const vaultData: AutotypeVaultData = {
      username: cipherView.login.username,
      password: cipherView.login.password,
    };
    return [null, vaultData];
  }
}
