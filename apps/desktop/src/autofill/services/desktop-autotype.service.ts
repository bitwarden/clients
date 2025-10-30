import { combineLatest, filter, firstValueFrom, map, Observable, of, switchMap } from "rxjs";

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

import { AutotypeVaultData } from "../models/autotype-vault-data";

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

  autotypeEnabledUserSetting$: Observable<boolean> = of(false);
  resolvedAutotypeEnabled$: Observable<boolean> = of(false);
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
    ipc.autofill.listenAutotypeRequest(async (windowTitle, callback) => {
      const possibleCiphers = await this.matchCiphersToWindowTitle(windowTitle);
      const firstCipher = possibleCiphers?.at(0);

      if (!firstCipher) {
        return callback(Error("No matching vault item."), null);
      } else if (
        firstCipher.login.username === undefined ||
        firstCipher.login.password === undefined
      ) {
        return callback(Error("Vault item is undefined."), null);
      } else {
        const vaultData: AutotypeVaultData = {
          username: firstCipher.login.username,
          password: firstCipher.login.password,
        };
        return callback(null, vaultData);
      }
    });
  }

  async init() {
    this.autotypeEnabledUserSetting$ = this.autotypeEnabledState.state$;
    this.autotypeKeyboardShortcut$ = this.autotypeKeyboardShortcut.state$.pipe(
      map((shortcut) => shortcut ?? defaultWindowsAutotypeKeyboardShortcut),
    );

    // Currently Autotype is only supported for Windows
    if (this.platformUtilsService.getDevice() === DeviceType.WindowsDesktop) {
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
        )
        .subscribe();

      // autotypeEnabledUserSetting$ publicly represents the value the
      // user has set for autotyeEnabled in their local settings.
      this.autotypeEnabledUserSetting$ = this.autotypeEnabledState.state$;

      // resolvedAutotypeEnabled$ represents the final determination if the Autotype
      // feature should be on or off.
      this.resolvedAutotypeEnabled$ = combineLatest([
        this.autotypeEnabledState.state$,
        this.configService.getFeatureFlag$(FeatureFlag.WindowsDesktopAutotype),
        this.accountService.activeAccount$.pipe(
          map((activeAccount) => activeAccount?.id),
          switchMap((userId) => this.authService.authStatusFor$(userId)),
        ),
        this.accountService.activeAccount$.pipe(
          filter((account): account is Account => !!account),
          switchMap((account) =>
            this.billingAccountProfileStateService.hasPremiumFromAnySource$(account.id),
          ),
        ),
      ]).pipe(
        map(
          ([autotypeEnabled, windowsDesktopAutotypeFeatureFlag, authStatus, hasPremium]) =>
            autotypeEnabled &&
            windowsDesktopAutotypeFeatureFlag &&
            authStatus == AuthenticationStatus.Unlocked &&
            hasPremium,
        ),
      );

      combineLatest([this.resolvedAutotypeEnabled$, this.autotypeKeyboardShortcut$]).subscribe(
        ([resolvedAutotypeEnabled, autotypeKeyboardShortcut]) => {
          ipc.autofill.configureAutotype(resolvedAutotypeEnabled, autotypeKeyboardShortcut);
        },
      );
    }
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
