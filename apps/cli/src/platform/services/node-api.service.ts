import * as FormData from "form-data";
import { HttpsProxyAgent } from "https-proxy-agent";
import * as fe from "node-fetch";

import { TokenService } from "@bitwarden/common/auth/abstractions/token.service";
import { AppIdService } from "@bitwarden/common/platform/abstractions/app-id.service";
import { EnvironmentService } from "@bitwarden/common/platform/abstractions/environment.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
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
    stateService: StateService,
    logoutCallback: (expired: boolean) => Promise<void>,
    customUserAgent: string = null,
  ) {
    super(
      tokenService,
      platformUtilsService,
      environmentService,
      appIdService,
      stateService,
      logoutCallback,
      customUserAgent,
    );
  }

  nativeFetch(request: Request): Promise<Response> {
    const proxy = process.env.http_proxy || process.env.https_proxy;
    if (proxy) {
      (request as any).agent = new HttpsProxyAgent(proxy);
    }
    return fetch(request);
  }
}
