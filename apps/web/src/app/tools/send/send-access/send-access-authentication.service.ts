import { Injectable } from "@angular/core";
import { Router, UrlTree } from "@angular/router";
import { map, of, from, catchError, timeout } from "rxjs";

import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { StateProvider } from "@bitwarden/common/platform/state";
import { SemanticLogger } from "@bitwarden/common/tools/log";
import { SystemServiceProvider } from "@bitwarden/common/tools/providers.js";
import { SendAccessRequest } from "@bitwarden/common/tools/send/models/request/send-access.request";
import { SendApiService } from "@bitwarden/common/tools/send/services/send-api.service.abstraction";

import { TOKEN_KEY, SEND_KEY_KEY } from "./send-access-memory";
import { isErrorResponse } from "./util";

const TEN_SECONDS = 10_000;

@Injectable({ providedIn: "root" })
export class SendAccessAuthenticationService {
  private readonly logger: SemanticLogger;

  constructor(
    private readonly state: StateProvider,
    private readonly api: SendApiService,
    private readonly router: Router,
    system: SystemServiceProvider,
    private configuration = {
      tryAccessTimeoutMs: TEN_SECONDS,
    },
  ) {
    this.logger = system.log({ type: "SendAccessAuthenticationService" });
  }

  redirect$(sendId: string) {
    const response$ = from(this.api.postSendAccess(sendId, new SendAccessRequest()));

    const redirect$ = response$.pipe(
      timeout({ first: this.configuration.tryAccessTimeoutMs }),
      map((_response) => {
        this.logger.info("public send detected; redirecting to send access with token.");
        const url = this.toViewRedirect(sendId);

        return url;
      }),
      catchError((error: unknown) => {
        let processed: UrlTree | undefined = undefined;

        if (isErrorResponse(error)) {
          processed = this.toErrorRedirect(sendId, error);
        }

        if (processed) {
          return of(processed);
        }

        throw error;
      }),
    );

    return redirect$;
  }

  private toViewRedirect(sendId: string) {
    return this.router.createUrlTree(["send", "content", sendId]);
  }

  private toErrorRedirect(sendId: string, response: ErrorResponse) {
    let url: UrlTree | undefined = undefined;

    switch (response.statusCode) {
      case 401:
        this.logger.debug(response, "redirecting to password flow");
        url = this.router.createUrlTree(["send/", sendId]);
        break;

      case 404:
        this.logger.debug(response, "redirecting to unavailable page");
        url = this.router.parseUrl("/404.html");
        break;

      default:
        this.logger.warn(response, "received unexpected error response");
    }

    return url;
  }

  async setToken(token: string) {
    return this.state.getGlobal(TOKEN_KEY).update(() => token);
  }

  async setKey(key: string) {
    return this.state.getGlobal(SEND_KEY_KEY).update(() => key);
  }

  async clear(): Promise<void> {
    await this.state.getGlobal(TOKEN_KEY).update(() => null);
    await this.state.getGlobal(SEND_KEY_KEY).update(() => null);
  }
}
