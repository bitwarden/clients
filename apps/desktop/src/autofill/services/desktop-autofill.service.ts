import { Injectable, OnDestroy } from "@angular/core";
import { EMPTY, Subject, distinctUntilChanged, mergeMap, switchMap, takeUntil } from "rxjs";

import { FeatureFlag } from "@bitwarden/common/enums/feature-flag.enum";
import { UriMatchStrategy } from "@bitwarden/common/models/domain/domain-service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { getCredentialsForAutofill } from "@bitwarden/common/platform/services/fido2/fido2-autofill-utils";
import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import { CipherType } from "@bitwarden/common/vault/enums";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import { NativeAutofillStatusCommand } from "../../platform/main/autofill/status.command";
import {
  NativeAutofillFido2Credential,
  NativeAutofillPasswordCredential,
  NativeAutofillSyncCommand,
} from "../../platform/main/autofill/sync.command";

@Injectable()
export class DesktopAutofillService implements OnDestroy {
  private destroy$ = new Subject<void>();

  constructor(
    private logService: LogService,
    private cipherService: CipherService,
    private configService: ConfigService,
  ) {}

  async init() {
    this.configService
      .getFeatureFlag$(FeatureFlag.MacOsNativeCredentialSync)
      .pipe(
        distinctUntilChanged(),
        switchMap((enabled) => {
          if (!enabled) {
            return EMPTY;
          }

          return this.cipherService.cipherViews$;
        }),
        // TODO: This will unset all the autofill credentials on the OS
        // when the account locks. We should instead explicilty clear the credentials
        // when the user logs out. Maybe by subscribing to the encrypted ciphers observable instead.
        mergeMap((cipherViewMap) => this.sync(Object.values(cipherViewMap ?? []))),
        takeUntil(this.destroy$),
      )
      .subscribe();
  }

  /** Give metadata about all available credentials in the users vault */
  async sync(cipherViews: CipherView[]) {
    const status = await this.status();
    if (status.type === "error") {
      return this.logService.error("Error getting autofill status", status.error);
    }

    if (!status.value.state.enabled) {
      // Autofill is disabled
      return;
    }

    let fido2Credentials: NativeAutofillFido2Credential[];
    let passwordCredentials: NativeAutofillPasswordCredential[];

    if (status.value.support.password) {
      passwordCredentials = cipherViews
        .filter(
          (cipher) =>
            cipher.type === CipherType.Login &&
            cipher.login.uris?.length > 0 &&
            cipher.login.uris.some((uri) => uri.match !== UriMatchStrategy.Never) &&
            cipher.login.uris.some((uri) => !Utils.isNullOrWhitespace(uri.uri)) &&
            !Utils.isNullOrWhitespace(cipher.login.username),
        )
        .map((cipher) => ({
          type: "password",
          cipherId: cipher.id,
          uri: cipher.login.uris.find((uri) => uri.match !== UriMatchStrategy.Never).uri,
          username: cipher.login.username,
        }));
    }

    if (status.value.support.fido2) {
      fido2Credentials = (await getCredentialsForAutofill(cipherViews)).map((credential) => ({
        type: "fido2",
        ...credential,
      }));
    }

    const syncResult = await ipc.autofill.runCommand<NativeAutofillSyncCommand>({
      namespace: "autofill",
      command: "sync",
      params: {
        credentials: [...fido2Credentials, ...passwordCredentials],
      },
    });

    if (syncResult.type === "error") {
      return this.logService.error("Error syncing autofill credentials", syncResult.error);
    }

    this.logService.debug(`Synced ${syncResult.value.added} autofill credentials`);
  }

  /** Get autofill status from OS */
  private status() {
    // TODO: Investigate why this type needs to be explicitly set
    return ipc.autofill.runCommand<NativeAutofillStatusCommand>({
      namespace: "autofill",
      command: "status",
      params: {},
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
