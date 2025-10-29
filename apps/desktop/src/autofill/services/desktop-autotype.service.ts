import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import {
  combineLatest,
  concatMap,
  filter,
  firstValueFrom,
  map,
  Observable,
  of,
  switchMap,
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
import { UserId } from "@bitwarden/user-core";

import { AutotypeConfig } from "../models/autotype-configure";

import { DesktopAutotypeDefaultSettingPolicy } from "./desktop-autotype-policy.service";

export const defaultWindowsAutotypeKeyboardShortcut: string[] = ["Control", "Shift", "B"];

export const AUTOTYPE_ENABLED = new KeyDefinition<boolean | null>(
  AUTOTYPE_SETTINGS_DISK,
  "autotypeEnabled",
  { deserializer: (b) => b },
);

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

export class DesktopAutotypeService {
  private readonly autotypeEnabledState = this.globalStateProvider.get(AUTOTYPE_ENABLED);
  private readonly autotypeKeyboardShortcut = this.globalStateProvider.get(
    AUTOTYPE_KEYBOARD_SHORTCUT,
  );

  // The enabled/disabled state from the user settings menu
  autotypeEnabledUserSetting$: Observable<boolean> = of(false);

  // The keyboard shortcut from the user settings menu
  autotypeKeyboardShortcut$: Observable<string[]> = of(defaultWindowsAutotypeKeyboardShortcut);

  constructor(
    private accountService: AccountService,
    private authService: AuthService,
    private cipherService: CipherService,
    private configService: ConfigService,
    private globalStateProvider: GlobalStateProvider,
    private platformUtilsService: PlatformUtilsService,
    private billingAccountProfileStateService: BillingAccountProfileStateService,
    private desktopAutotypePolicy: DesktopAutotypeDefaultSettingPolicy,
  ) {
    this.autotypeEnabledUserSetting$ = this.autotypeEnabledState.state$.pipe(
      map((enabled) => enabled ?? false),
    );

    this.autotypeKeyboardShortcut$ = this.autotypeKeyboardShortcut.state$.pipe(
      map((shortcut) => shortcut ?? defaultWindowsAutotypeKeyboardShortcut),
    );

    ipc.autofill.listenAutotypeRequest(async (windowTitle, callback) => {
      const possibleCiphers = await this.matchCiphersToWindowTitle(windowTitle);
      const firstCipher = possibleCiphers?.at(0);

      return callback(null, {
        username: firstCipher?.login?.username,
        password: firstCipher?.login?.password,
      });
    });
  }

  async init() {
    // Currently Autotype is only supported for Windows
    if (this.platformUtilsService.getDevice() !== DeviceType.WindowsDesktop) {
      return;
    }

    if (!(await ipc.autofill.autotypeIsInitialized())) {
      await ipc.autofill.initAutotype();
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
        map(async ([autotypeEnabledState, autotypeDefaultPolicy]) => {
          if (autotypeDefaultPolicy === true && autotypeEnabledState === null) {
            await this.setAutotypeEnabledState(true);
          }
        }),
        takeUntilDestroyed(),
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
        takeUntilDestroyed(),
      )
      .subscribe();

    // listen for changes in factors that are required for enablement of the feature
    combineLatest([
      // if the user has enabled the setting
      this.autotypeEnabledUserSetting$,
      // if the feature flag is set
      this.configService.getFeatureFlag$(FeatureFlag.WindowsDesktopAutotype),
      // if there is an active account with an unlocked vault
      this.authService.activeAccountStatus$,
      // if the user's account is Premium
      this.accountService.activeAccount$.pipe(
        filter((account): account is Account => !!account),
        switchMap((account) =>
          this.billingAccountProfileStateService.hasPremiumFromAnySource$(account.id),
        ),
      ),
    ])
      .pipe(
        concatMap(async ([settingsEnabled, ffEnabled, authStatus, hasPremium]) => {
          const enabled =
            settingsEnabled &&
            ffEnabled &&
            authStatus == AuthenticationStatus.Unlocked &&
            hasPremium;

          ipc.autofill.toggleAutotype(enabled);
        }),
        takeUntilDestroyed(),
      )
      .subscribe();
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
}
