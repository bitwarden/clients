import { Injectable, OnDestroy } from "@angular/core";
import { Subject, mergeMap, takeUntil } from "rxjs";

import { UriMatchStrategy } from "@bitwarden/common/models/domain/domain-service";
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
import { isDev } from "../../utils";

@Injectable()
export class DesktopAutofillService implements OnDestroy {
  private destroy$ = new Subject<void>();

  constructor(
    private logService: LogService,
    private cipherService: CipherService,
  ) {
    this.cipherService.cipherViews$
      .pipe(
        mergeMap((cipherViewMap) => this.sync(Object.values(cipherViewMap))),
        takeUntil(this.destroy$),
      )
      .subscribe();
  }

  async init() {
    if (isDev()) {
      (window as any).DesktopAutofillService = this;
    }
  }

  /** Used for development purposes. TODO: Remove before merging */
  async manualSync() {
    await this.sync(await this.cipherService.getAllDecrypted());
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
      command: "status",
      params: {},
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
