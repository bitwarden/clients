// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import * as FormData from "form-data";
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

/**
 * Returns true when the request host matches the `no_proxy` / `NO_PROXY` list
 * (or `npm_config_no_proxy`, which takes precedence, as in npm and proxy-from-env).
 * Supports `*`, comma-separated entries, leading-dot and `*.` domain suffixes,
 * and optional `:port` suffixes.
 */
export function isNoProxyHost(url: string, noProxy?: string): boolean {
  const list =
    noProxy ||
    process.env.npm_config_no_proxy ||
    process.env.NPM_CONFIG_NO_PROXY ||
    process.env.no_proxy ||
    process.env.NO_PROXY ||
    "";
  const entries = list
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e.length > 0);
  if (entries.length === 0) {
    return false;
  }
  if (entries.includes("*")) {
    return true;
  }

  let hostname: string;
  let port: string;
  try {
    const parsed = new URL(url);
    hostname = parsed.hostname.toLowerCase();
    port = parsed.port;
  } catch {
    return false;
  }

  return entries.some((entry) => {
    let entryHost = entry;
    let entryPort = "";
    const portMatch = entry.match(/^(.*):(\d+)$/);
    if (portMatch) {
      entryHost = portMatch[1];
      entryPort = portMatch[2];
    }
    if (entryPort && entryPort !== port) {
      return false;
    }
    entryHost = entryHost.replace(/^\*?\./, "");
    if (!entryHost) {
      return false;
    }
    return hostname === entryHost || hostname.endsWith("." + entryHost);
  });
}

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

  async nativeFetch(request: Request): Promise<Response> {
    const proxy = process.env.http_proxy || process.env.https_proxy;
    if (proxy && !isNoProxyHost(request.url)) {
      const { HttpsProxyAgent } = await import("https-proxy-agent");
      (request as any).agent = new HttpsProxyAgent(proxy);
    }
    return fetch(request);
  }

  /** XMLHttpRequest is not supported in Node.js, fallback to fetch */
  override nativeXMLHttpRequest(
    request: Request,
    _onProgress: (percentage: number) => void,
  ): Promise<Response> {
    return this.nativeFetch(request);
  }
}
