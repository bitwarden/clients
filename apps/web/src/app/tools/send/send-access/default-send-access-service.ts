import { Injectable, Inject } from "@angular/core";
import { Router, UrlTree } from "@angular/router";
import { map, of, from, catchError, timeout } from "rxjs";

import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { StateProvider } from "@bitwarden/common/platform/state";
import { SemanticLogger } from "@bitwarden/common/tools/log";
import { SystemServiceProvider } from "@bitwarden/common/tools/providers";
import { SendAccessRequest } from "@bitwarden/common/tools/send/models/request/send-access.request";
import { SendApiService } from "@bitwarden/common/tools/send/services/send-api.service.abstraction";
import { SYSTEM_SERVICE_PROVIDER } from "@bitwarden/generator-components";

import { SEND_RESPONSE_KEY, SEND_CONTEXT_KEY } from "./send-access-memory";
import { SendAccessService } from "./send-access-service.abstraction";
import { isErrorResponse } from "./util";

const TEN_SECONDS = 10_000;

@Injectable({ providedIn: "root" })
export class DefaultSendAccessService implements SendAccessService {
  private readonly logger: SemanticLogger;

  constructor(
    private readonly state: StateProvider,
    private readonly api: SendApiService,
    private readonly router: Router,
    @Inject(SYSTEM_SERVICE_PROVIDER) system: SystemServiceProvider,
  ) {
    this.logger = system.log({ type: "SendAccessAuthenticationService" });
  }

  redirect$(sendId: string) {
    // FIXME: when the send authentication APIs become available, this method
    //   should delegate to the API
    const response$ = from(this.api.postSendAccess(sendId, new SendAccessRequest()));

    const redirect$ = response$.pipe(
      timeout({ first: TEN_SECONDS }),
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
        url = this.router.createUrlTree(["send/password", sendId]);
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

  async setContext(sendId: string, key: string) {
    await this.state.getGlobal(SEND_CONTEXT_KEY).update(() => ({ id: sendId, key }));
  }

  async clear(): Promise<void> {
    await this.state.getGlobal(SEND_RESPONSE_KEY).update(() => null);
    await this.state.getGlobal(SEND_CONTEXT_KEY).update(() => null);
  }
}
