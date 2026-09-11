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
import { IpcService } from "@bitwarden/common/platform/ipc";
import {
  GlobalStateProvider,
  AUTOTYPE_SETTINGS_DISK,
  KeyDefinition,
} from "@bitwarden/common/platform/state";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { LogService } from "@bitwarden/logging";
import { autotypeRegisterEchoHandler, autotypeRequestEcho } from "@bitwarden/sdk-internal";

import { DEFAULT_KEYBOARD_SHORTCUT } from "../models/main-autotype-keyboard-shortcut";

import { DesktopAutotypeDefaultSettingPolicy } from "./desktop-autotype-policy.service";

export const AUTOTYPE_ENABLED = new KeyDefinition<boolean | null>(
  AUTOTYPE_SETTINGS_DISK,
  "autotypeGaEnabled",
  { deserializer: (b) => b },
);

export const AUTOTYPE_KEYBOARD_SHORTCUT = new KeyDefinition<string[] | null>(
  AUTOTYPE_SETTINGS_DISK,
  "autotypeGaKeyboardShortcut",
  { deserializer: (b) => b },
);

export type Result<T, E = Error> = [E, null] | [null, T];

// Matches DISCOVER_MESSAGE_TIMEOUT_MS used by the browser's desktop IPC transport.
const AUTOTYPE_ECHO_TIMEOUT_MS = 5_000;

@Injectable({
  providedIn: "root",
})
export class DesktopAutotypeService implements OnDestroy {
  private readonly autotypeEnabledState = this.globalStateProvider.get(AUTOTYPE_ENABLED);
  private readonly autotypeKeyboardShortcut = this.globalStateProvider.get(
    AUTOTYPE_KEYBOARD_SHORTCUT,
  );

  // If the user's account is Premium
  private readonly isPremiumAccount$: Observable<boolean>;

  // The enabled/disabled state from the user settings menu
  autotypeEnabledUserSetting$: Observable<boolean> = of(false);

  // The saved keyboard shortcut to invoke Autotype
  autotypeKeyboardShortcut$: Observable<string[]> = of(DEFAULT_KEYBOARD_SHORTCUT);

  private destroy$ = new Subject<void>();

  constructor(
    private accountService: AccountService,
    private authService: AuthService,
    private cipherService: CipherService,
    private configService: ConfigService,
    private globalStateProvider: GlobalStateProvider,
    private ipcService: IpcService,
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
    // Runs before the Windows-only gate below so the encrypted IPC channel is
    // exercised on every platform during development.
    await this.initEncryptedIpc();

    // Currently Autotype is only supported for Windows
    if (this.platformUtilsService.getDevice() !== DeviceType.WindowsDesktop) {
      return;
    }

    //ipc.autofill.autotype.listenRequest(async (windowTitle, callback) => {
    //  const possibleCiphers = await this.matchCiphersToWindowTitle(windowTitle);
    //  const firstCipher = possibleCiphers?.at(0);
    //  const [error, vaultData] = getAutotypeVaultData(firstCipher);
    //  callback(error, vaultData);
    //});

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
          //const config: AutotypeConfig = {
          //  keyboardShortcut,
          //};
          //ipc.autofill.autotype.configure(config);
        }),
        takeUntil(this.destroy$),
      )
      .subscribe();

    this.autotypeFeatureEnabled$
      .pipe(
        concatMap(async (enabled) => {
          //ipc.autofill.autotype.toggle(enabled);
        }),
        takeUntil(this.destroy$),
      )
      .subscribe();
  }

  /**
   * Registers the autotype echo handler and proves the Noise-encrypted SDK IPC
   * channel round-trips between this renderer and the main process.
   *
   * The renderer initiates because it initializes last, so the main process is
   * guaranteed to have registered its handler already. Real autotype requests
   * replace this echo once the wire format is settled.
   */
  private async initEncryptedIpc() {
    try {
      await autotypeRegisterEchoHandler(this.ipcService.client);

      const response = await autotypeRequestEcho(
        this.ipcService.client,
        "DesktopMain",
        "autotype echo from renderer",
        AbortSignal.timeout(AUTOTYPE_ECHO_TIMEOUT_MS),
      );

      this.logService.info(`Autotype echo round-trip succeeded: ${response.message}`);
    } catch (e) {
      this.logService.error("Autotype echo round-trip failed.", e);
    }
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
    await this.autotypeKeyboardShortcut.update(() => keyboardShortcut);
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
