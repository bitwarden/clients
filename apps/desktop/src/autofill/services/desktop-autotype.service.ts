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

import { AutotypeConfig } from "../models/autotype-configure";
import { AutotypeVaultData } from "../models/autotype-vault-data";

import { DesktopAutotypeDefaultSettingPolicy } from "./desktop-autotype-policy.service";

export const defaultWindowsAutotypeKeyboardShortcut: string[] = ["Control", "Shift", "B"];

export const AUTOTYPE_ENABLED = new KeyDefinition<boolean | null>(
  AUTOTYPE_SETTINGS_DISK,
  "autotypeEnabled",
  { deserializer: (b) => b },
);

export type Result<T, E = Error> = [E, null] | [null, T];

/*
  Valid windows shortcut keys: Control, Alt, Super, Shift, letters A - Z
  Valid macOS shortcut keys: Control, Alt, Command, Shift, letters A - Z

  See Electron keyboard shorcut docs for more info:
  https://www.electronjs.org/docs/latest/tutorial/keyboard-shortcuts
*/
export const AUTOTYPE_KEYBOARD_SHORTCUT = new KeyDefinition<string[]>(
  AUTOTYPE_SETTINGS_DISK,
  "autotypeKeyboardShortcut",
  { deserializer: (b) => b },
);

@Injectable({
  providedIn: "root",
})
export class DesktopAutotypeService implements OnDestroy {
  private readonly autotypeEnabledState = this.globalStateProvider.get(AUTOTYPE_ENABLED);
  private readonly autotypeKeyboardShortcut = this.globalStateProvider.get(
    AUTOTYPE_KEYBOARD_SHORTCUT,
  );

  // if the user's account is Premium
  private readonly isPremiumAccount$: Observable<boolean>;

  // The enabled/disabled state from the user settings menu
  autotypeEnabledUserSetting$: Observable<boolean>;

  // The keyboard shortcut from the user settings menu
  autotypeKeyboardShortcut$: Observable<string[]> = of(defaultWindowsAutotypeKeyboardShortcut);

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
      map((shortcut) => shortcut ?? defaultWindowsAutotypeKeyboardShortcut),
      takeUntil(this.destroy$),
    );
  }

  async init() {
    // Currently Autotype is only supported for Windows
    if (this.platformUtilsService.getDevice() !== DeviceType.WindowsDesktop) {
      return;
    }

    ipc.autofill.listenAutotypeRequest(async (windowTitle, callback) => {
      const possibleCiphers = await this.matchCiphersToWindowTitle(windowTitle);
      const firstCipher = possibleCiphers?.at(0);
      const [error, vaultData] = getAutotypeVaultData(firstCipher);
      callback(error, vaultData);
    });

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

    // listen for changes in keyboard shortcut settings
    this.autotypeKeyboardShortcut$
      .pipe(
        concatMap(async (keyboardShortcut) => {
          const config: AutotypeConfig = {
            keyboardShortcut,
          };
          ipc.autofill.configureAutotype(config);
        }),
        takeUntil(this.destroy$),
      )
      .subscribe();

    this.autotypeFeatureEnabled$
      .pipe(
        concatMap(async (enabled) => {
          ipc.autofill.toggleAutotype(enabled);
        }),
        takeUntil(this.destroy$),
      )
      .subscribe();
  }

  private get autotypeFeatureEnabled$(): Observable<boolean> {
    // listen for changes in factors that are required for enablement of the feature
    return combineLatest([
      // if the user has enabled the setting
      this.autotypeEnabledUserSetting$,
      // if the feature flag is set
      this.configService.getFeatureFlag$(FeatureFlag.WindowsDesktopAutotype),
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
    this.destroy$.next();
    this.destroy$.complete();
  }
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
