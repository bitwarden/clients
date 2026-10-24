// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { TokenService } from "@bitwarden/common/auth/abstractions/token.service";
import { VaultTimeoutSettingsService } from "@bitwarden/common/key-management/vault-timeout";
import { AppIdService } from "@bitwarden/common/platform/abstractions/app-id.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ApiService } from "@bitwarden/common/services/api.service";

/**
 * The {@link ApiService} implementation for the Electron main process. Electron's Node.js runtime
 * already provides the `fetch`, `Request`, `Response`, `Headers`, and `FormData` globals that the
 * base {@link ApiService} relies on.
 */
export class NodeApiService extends ApiService {
  constructor(
    tokenService: TokenService,
    platformUtilsService: PlatformUtilsService,
    environmentService: EnvironmentService,
    appIdService: AppIdService,
    refreshAccessTokenErrorCallback: () => Promise<void>,
    logService: LogService,
    logoutCallback: () => Promise<void>,
    vaultTimeoutSettingsService: VaultTimeoutSettingsService,
    accountService: AccountService,
    customUserAgent: string = null,
  ) {
    super(
      tokenService,
      platformUtilsService,
      environmentService,
      appIdService,
      refreshAccessTokenErrorCallback,
      logService,
      logoutCallback,
      vaultTimeoutSettingsService,
      accountService,
      { createRequest: (url, request) => new Request(url, request) },
      customUserAgent,
    );
  }
}
