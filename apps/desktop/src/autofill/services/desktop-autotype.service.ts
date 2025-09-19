import { combineLatest, filter, firstValueFrom, map, Observable, of, switchMap } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
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

export const AUTOTYPE_ENABLED = new KeyDefinition<boolean>(
  AUTOTYPE_SETTINGS_DISK,
  "autotypeEnabled",
  { deserializer: (b) => b },
);

export class DesktopAutotypeService {
  private readonly autotypeEnabledState = this.globalStateProvider.get(AUTOTYPE_ENABLED);

  resolvedAutotypeEnabled$: Observable<boolean> = of(false);

  constructor(
    private accountService: AccountService,
    private authService: AuthService,
    private cipherService: CipherService,
    private configService: ConfigService,
    private globalStateProvider: GlobalStateProvider,
    private platformUtilsService: PlatformUtilsService,
    private billingAccountProfileStateService: BillingAccountProfileStateService,
  ) {
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
    if (this.platformUtilsService.getDevice() === DeviceType.WindowsDesktop) {
      this.resolvedAutotypeEnabled$ = combineLatest([
        this.autotypeEnabledState.state$,
        this.configService.getFeatureFlag$(FeatureFlag.WindowsDesktopAutotype),
        this.accountService.activeAccount$.pipe(
          map((activeAccount) => activeAccount?.id),
          switchMap((userId) => this.authService.authStatusFor$(userId)),
        ),
        this.accountService.activeAccount$.pipe(
          map((activeAccount) => activeAccount?.id),
          switchMap((userId) =>
            this.billingAccountProfileStateService.hasPremiumFromAnySource$(userId),
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

      this.resolvedAutotypeEnabled$.subscribe((enabled) => {
        ipc.autofill.configureAutotype(enabled);
      });
    }
  }

  async setAutotypeEnabledState(enabled: boolean): Promise<void> {
    await this.autotypeEnabledState.update(() => enabled, {
      shouldUpdate: (currentlyEnabled) => currentlyEnabled !== enabled,
    });
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

          const uri = u.uri.substring(4).toLowerCase();

          return windowTitle.indexOf(uri) > -1;
        })
      );
    });

    return possibleCiphers;
  }
}
