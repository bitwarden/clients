import { combineLatest, filter, firstValueFrom, map, Observable, of, switchMap } from "rxjs";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import {
  GlobalStateProvider,
  AUTOTYPE_SETTINGS_DISK,
  KeyDefinition,
} from "@bitwarden/common/platform/state";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { UserId } from "@bitwarden/user-core";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { DeviceType } from "@bitwarden/common/enums";

export const AUTOTYPE_ENABLED = new KeyDefinition<boolean>(
  AUTOTYPE_SETTINGS_DISK,
  "autotypeEnabled",
  { deserializer: (b) => b },
);

export class DesktopAutotypeService {
  private readonly autotypeEnabledState = this.globalStateProvider.get(AUTOTYPE_ENABLED);

  autotypeEnabled$: Observable<boolean> = of(false);

  constructor(
    private accountService: AccountService,
    private cipherService: CipherService,
    private configService: ConfigService,
    private globalStateProvider: GlobalStateProvider,
    private platformUtilsService: PlatformUtilsService,
  ) {
    // fix me
    if (this.platformUtilsService.getDevice() === DeviceType.WindowsDesktop) {
      ipc.autofill.configureAutotype(true);
      this.autotypeEnabled$ = combineLatest([
        this.autotypeEnabledState.state$,
        this.configService.getFeatureFlag$(FeatureFlag.WindowsDesktopAutotype),
      ]).pipe(
        map(
          ([autotypeEnabled, windowsDesktopAutotypeFeatureFlag]) =>
            autotypeEnabled && windowsDesktopAutotypeFeatureFlag,
        ),
      );
    }

    // ipc stuff
    ipc.autofill.listenAutotypeRequest(async (windowTitle) => {
      windowTitle = windowTitle.toLowerCase();

      let ciphers = await firstValueFrom(this.accountService.activeAccount$.pipe(
        map((account) => account?.id),
        filter((userId): userId is UserId => userId != null),
        switchMap((userId) => this.cipherService.cipherViews$(userId)),
      ));
      let possibleCiphers = ciphers.filter(c => {
        return c.login?.username && c.login?.password && c.login?.uris.some(u => {
          if (u.uri?.indexOf("APP:") !== 0) {
            return false;
          }

          console.log("checking uri: " + u.uri);

          let uri = u.uri.substring(4).toLowerCase();

          console.log("matching on uri: " + uri);
          console.log("matches? " + (windowTitle.indexOf(uri) > -1))

          return windowTitle.indexOf(uri) > -1;
        });
      });

      let first = possibleCiphers?.at(0);
      console.log(first);
      console.log("finally returning:\n" + first?.login?.username + "\n" + first?.login?.password);

      return { username: first?.login?.username, password: first?.login?.password };
    });
  }

  async setAutotypeEnabledState(enabled: boolean): Promise<void> {
    await this.autotypeEnabledState.update(() => enabled, {
      shouldUpdate: (currentlyEnabled) => currentlyEnabled !== enabled,
    });
  }
}
