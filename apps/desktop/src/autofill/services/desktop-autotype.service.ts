import { Injectable, OnDestroy } from "@angular/core";
import {
  combineLatest,
  concatMap,
  distinctUntilChanged,
  filter,
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
import { LogService } from "@bitwarden/logging";

import { DEFAULT_KEYBOARD_SHORTCUT } from "../models/main-autotype-keyboard-shortcut";

import { DesktopAutotypeDefaultSettingPolicy } from "./desktop-autotype-policy.service";

/*
  The storage key definition for whether the user's local Autotype GA
  setting is enabled or not.
*/
export const AUTOTYPE_GA_ENABLED = new KeyDefinition<boolean | null>(
  AUTOTYPE_SETTINGS_DISK,
  "autotypeGaEnabled",
  { deserializer: (b) => b },
);

/*
  The storage key definition for the keyboard shortcut used to activate
  Autotype GA.

  Valid windows shortcut keys: Control, Alt, Super, Shift, letters A - Z
  Valid macOS shortcut keys: Control, Alt, Command, Shift, letters A - Z

  See Electron keyboard shortcut docs for more info:
  https://www.electronjs.org/docs/latest/tutorial/keyboard-shortcuts
*/
export const AUTOTYPE_GA_KEYBOARD_SHORTCUT = new KeyDefinition<string[]>(
  AUTOTYPE_SETTINGS_DISK,
  "autotypeGaKeyboardShortcut",
  { deserializer: (b) => b },
);

export type Result<T, E = Error> = [E, null] | [null, T];

@Injectable({
  providedIn: "root",
})
export class DesktopAutotypeService implements OnDestroy {
  private readonly autotypeEnabledState = this.globalStateProvider.get(AUTOTYPE_GA_ENABLED);
  private readonly autotypeKeyboardShortcutState = this.globalStateProvider.get(
    AUTOTYPE_GA_KEYBOARD_SHORTCUT,
  );

  // If the user's account is Premium
  private readonly isPremiumAccount$: Observable<boolean>;

  // The observable representing if the user has enabled or disabled
  // Autotype in the user settings menu
  autotypeEnabledUserSetting$: Observable<boolean> = of(false);

  // The observable representing the keyboard shortcut the user
  // has defined in the user settings menu
  autotypeKeyboardShortcut$: Observable<string[]> = of(DEFAULT_KEYBOARD_SHORTCUT);

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

    this.autotypeKeyboardShortcut$ = this.autotypeKeyboardShortcutState.state$.pipe(
      map((shortcut) => shortcut ?? DEFAULT_KEYBOARD_SHORTCUT),
      takeUntil(this.destroy$),
    );
  }

  async init() {
    // Currently Autotype is only supported for Windows
    if (this.platformUtilsService.getDevice() !== DeviceType.WindowsDesktop) {
      return;
    }

    // If `autotypeDefaultPolicy` is `true` for a user's organization, and the
    // user has never changed their local autotype setting (`autotypeEnabledState`),
    // we set their local setting to `true` (once the local user setting is changed
    // by this policy or the user themselves, the default policy should
    // never change the user setting again).
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
          // TODO: inform the main process the keyboard shortcut setting changed
          //       (PM-38967)
        }),
        takeUntil(this.destroy$),
      )
      .subscribe();

    // Enable or disable Autotype
    this.autotypeFeatureEnabled$
      .pipe(
        concatMap(async (enabled) => {
          // TODO: inform the main process the keyboard shortcut setting changed
          //       (PM-38967)
        }),
        takeUntil(this.destroy$),
      )
      .subscribe();
  }

  // Returns an observable that represents whether autotype is enabled for the current user.
  private get autotypeFeatureEnabled$(): Observable<boolean> {
    return combineLatest([
      // if the user has enabled the setting
      this.autotypeEnabledUserSetting$,
      // if the feature flag is set
      this.configService.getFeatureFlag$(FeatureFlag.WindowsDesktopAutotypeGA),
      // if there is an active account with an unlocked vault
      this.authService.activeAccountStatus$,
      // if the active user's account is Premium
      this.isPremiumAccount$,
    ]).pipe(
      map(
        ([settingsEnabled, ffEnabled, authStatus, isPremiumAcct]) =>
          settingsEnabled &&
          ffEnabled &&
          authStatus === AuthenticationStatus.Unlocked &&
          isPremiumAcct,
      ),
      distinctUntilChanged(), // Only emit when the boolean result changes
      takeUntil(this.destroy$),
    );
  }

  async setAutotypeEnabledState(enabled: boolean): Promise<void> {
    await this.autotypeEnabledState.update(() => enabled, {
      shouldUpdate: (currentlyEnabled) => currentlyEnabled !== enabled,
    });
  }

  async setAutotypeKeyboardShortcutState(keyboardShortcut: string[]): Promise<void> {
    await this.autotypeKeyboardShortcutState.update(() => keyboardShortcut);
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
