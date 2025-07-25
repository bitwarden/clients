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
    // ipc.autofill.listenAutotypeRequest(async (windowTitle) => {
    //   console.log("listenAutotypeRequest (desktop-autotype.service.ts)");
    //   windowTitle = windowTitle.toLowerCase();

    //   let ciphers = await firstValueFrom(this.accountService.activeAccount$.pipe(
    //     map((account) => account?.id),
    //     filter((userId): userId is UserId => userId != null),
    //     switchMap((userId) => this.cipherService.cipherViews$(userId)),
    //   ));
    //   let possibleCiphers = ciphers.filter(c => {
    //     return c.login?.username && c.login?.password && c.login?.uris.some(u => {
    //       if (u.uri?.indexOf("APP:") !== 0) {
    //         return false;
    //       }

    //       //console.log("checking uri: " + u.uri);

    //       let uri = u.uri.substring(4).toLowerCase();

    //       //console.log("matching on uri: " + uri);
    //       //console.log("matches? " + (windowTitle.indexOf(uri) > -1))

    //       return windowTitle.indexOf(uri) > -1;
    //     });
    //   });

    //   let first = possibleCiphers?.at(0);
    //   //console.log(first);
    //   //console.log("finally returning:\n" + first?.login?.username + "\n" + first?.login?.password);
    //   console.log("    returning: " + first?.login?.username + " " + first?.login?.password);
    //   //return { username: first?.login?.username, password: first?.login?.password };
    //   return { username: "fake username 1", password: "fake password 1"};
    // });

    ipc.autofill.listenAutotypeRequest(
      async (windowTitle, callback) => {
        console.log("listenAutotypeRequest (desktop-autotype.service.ts)");
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

            //console.log("checking uri: " + u.uri);

            let uri = u.uri.substring(4).toLowerCase();

            //console.log("matching on uri: " + uri);
            //console.log("matches? " + (windowTitle.indexOf(uri) > -1))

            return windowTitle.indexOf(uri) > -1;
          });
        });

        let first = possibleCiphers?.at(0);

        return callback(null, { username: first?.login?.username, password: first?.login?.password });

        // // For some reason the credentialId is passed as an empty array in the request, so we need to
        // // get it from the cipher. For that we use the recordIdentifier, which is the cipherId.
        // if (request.recordIdentifier && request.credentialId.length === 0) {
        //   const activeUserId = await firstValueFrom(
        //     this.accountService.activeAccount$.pipe(getOptionalUserId),
        //   );
        //   if (!activeUserId) {
        //     this.logService.error("listenPasskeyAssertion error", "Active user not found");
        //     callback(new Error("Active user not found"), null);
        //     return;
        //   }

        //   const cipher = await this.cipherService.get(request.recordIdentifier, activeUserId);
        //   if (!cipher) {
        //     this.logService.error("listenPasskeyAssertion error", "Cipher not found");
        //     callback(new Error("Cipher not found"), null);
        //     return;
        //   }

        //   const decrypted = await this.cipherService.decrypt(cipher, activeUserId);

        //   const fido2Credential = decrypted.login.fido2Credentials?.[0];
        //   if (!fido2Credential) {
        //     this.logService.error("listenPasskeyAssertion error", "Fido2Credential not found");
        //     callback(new Error("Fido2Credential not found"), null);
        //     return;
        //   }

        //   request.credentialId = Array.from(
        //     new Uint8Array(parseCredentialId(decrypted.login.fido2Credentials?.[0].credentialId)),
        //   );
        // }

        // const controller = new AbortController();
        // void this.fido2AuthenticatorService
        //   .getAssertion(
        //     this.convertAssertionRequest(request),
        //     { windowXy: request.windowXy },
        //     controller,
        //   )
        //   .then((response) => {
        //     callback(null, this.convertAssertionResponse(request, response));
        //   })
        //   .catch((error) => {
        //     this.logService.error("listenPasskeyAssertion error", error);
        //     callback(error, null);
        //   });
      },
    );
  }

  async setAutotypeEnabledState(enabled: boolean): Promise<void> {
    await this.autotypeEnabledState.update(() => enabled, {
      shouldUpdate: (currentlyEnabled) => currentlyEnabled !== enabled,
    });
  }
}
