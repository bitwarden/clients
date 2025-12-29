// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import * as FormData from "form-data";
import { HttpsProxyAgent } from "https-proxy-agent";
import * as fe from "node-fetch";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { TokenService } from "@bitwarden/common/auth/abstractions/token.service";
import { VaultTimeoutSettingsService } from "@bitwarden/common/key-management/vault-timeout";
import { AppIdService } from "@bitwarden/common/platform/abstractions/app-id.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { ApiService } from "@bitwarden/common/services/api.service";

(global as any).fetch = fe.default;
(global as any).Request = fe.Request;
(global as any).Response = fe.Response;
(global as any).Headers = fe.Headers;
(global as any).FormData = FormData;

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

  nativeFetch(request: Request): Promise<Response> {
    const proxy = process.env.http_proxy || process.env.https_proxy;
    if (proxy && !this.shouldBypassProxy(request.url)) {
      (request as any).agent = new HttpsProxyAgent(proxy);
    }
    return fetch(request);
  }

  private shouldBypassProxy(urlString: string): boolean {
    const noProxy = process.env.no_proxy || process.env.NO_PROXY;
    if (!noProxy) {
      return false;
    }

    let hostname: string;
    try {
      const url = new URL(urlString);
      hostname = url.hostname.toLowerCase();
    } catch {
      return false;
    }

    const noProxyList = noProxy.split(",").map((entry) => entry.trim().toLowerCase());

    for (const entry of noProxyList) {
      if (!entry) {
        continue;
      }

      // Match "*" which means bypass proxy for all hosts
      if (entry === "*") {
        return true;
      }

      // Match exact hostname
      if (hostname === entry) {
        return true;
      }

      // Match domain suffix (e.g., ".example.com" matches "api.example.com")
      if (entry.startsWith(".") && hostname.endsWith(entry)) {
        return true;
      }

      // Match domain suffix without leading dot (e.g., "example.com" matches "api.example.com")
      if (!entry.startsWith(".") && (hostname === entry || hostname.endsWith("." + entry))) {
        return true;
      }
    }

    return false;
  }
}
