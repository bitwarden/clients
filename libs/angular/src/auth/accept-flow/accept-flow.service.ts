import { Injectable } from "@angular/core";
import { Params, Router } from "@angular/router";
import { firstValueFrom } from "rxjs";

import { AuthService } from "@bitwarden/common/auth/abstractions/auth.service";
import { AuthenticationStatus } from "@bitwarden/common/auth/enums/authentication-status";
import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";
import { ToastService } from "@bitwarden/components";

/**
 * Caller-supplied behavior for one accept flow (org invite, emergency access, etc.).
 * The flow itself is generic over `TInvite` - the shape produced by {@link parse}.
 */
export interface AcceptFlowConfig<TInvite> {
  /** Toast i18n key used when no API error message is available (invalid link, non-Error throw). */
  failedMessage: string;
  /** Toast i18n key used when a handler throws an Error; the message is interpolated as the placeholder. */
  failedShortMessage?: string;
  /**
   * Parses raw query params into the typed shape the flow needs. Return null to signal an invalid
   * link - the service then short-circuits to the failed-toast + redirect path before dispatching.
   */
  parse: (params: Params | null) => TInvite | null;
  /** Invoked when the active account is not LoggedOut (Locked counts as authed). */
  authedHandler: (invite: TInvite) => Promise<void>;
  /** Invoked when the active account is LoggedOut. */
  unauthedHandler: (invite: TInvite) => Promise<void>;
  /** Override default error-message resolution. Receives the API error message, or null for invalid-link. */
  getErrorMessage?: (apiError: string | null) => string;
  /**
   * Invoked when the handler throws or the link is invalid, before the error toast + redirect.
   * Use this to clean up flow-specific state (e.g. the org-invite stash) so a thrown failure
   * does not leave dead state behind for later consumers.
   */
  onError?: () => Promise<void>;
}

/**
 * Shared scaffolding for "accept invite via emailed link" flows. Parses query params, picks the
 * authed or unauthed handler based on the active account, and routes any failure to a uniform
 * error toast + redirect to `/`. Per-flow specifics (parse shape, handlers, error wording) come
 * from {@link AcceptFlowConfig}.
 */
@Injectable({ providedIn: "root" })
export class AcceptFlowService {
  constructor(
    private authService: AuthService,
    private router: Router,
    private i18nService: I18nService,
    private toastService: ToastService,
  ) {}

  /**
   * Runs the accept flow: parse params, dispatch to the matching handler, and route any failure
   * (invalid link or handler throw) through the configured error path. Resolves when the flow
   * has finished or failed - never rejects.
   */
  async run<TInvite>(queryParams: Params, config: AcceptFlowConfig<TInvite>): Promise<void> {
    const invite = config.parse(queryParams);
    if (invite == null) {
      await this.handleError(null, config);
      return;
    }

    const status = await firstValueFrom(this.authService.activeAccountStatus$);
    const handler =
      status !== AuthenticationStatus.LoggedOut ? config.authedHandler : config.unauthedHandler;

    try {
      await handler(invite);
    } catch (e: unknown) {
      // `ErrorResponse` is the standard API error shape and carries a `message` field
      // but does not extend `Error`, so it must be recognized explicitly here.
      const message = e instanceof ErrorResponse || e instanceof Error ? e.message : null;
      await this.handleError(message, config);
    }
  }

  private async handleError<TInvite>(
    apiError: string | null,
    config: AcceptFlowConfig<TInvite>,
  ): Promise<void> {
    if (config.onError) {
      await config.onError();
    }

    const message = config.getErrorMessage
      ? config.getErrorMessage(apiError)
      : this.defaultErrorMessage(apiError, config);

    this.toastService.showToast({ message, variant: "error", timeout: 10000 });
    await this.router.navigate(["/"]);
  }

  private defaultErrorMessage<TInvite>(
    apiError: string | null,
    config: AcceptFlowConfig<TInvite>,
  ): string {
    const shortKey = config.failedShortMessage ?? "inviteAcceptFailedShort";
    return apiError != null
      ? this.i18nService.t(shortKey, apiError)
      : this.i18nService.t(config.failedMessage);
  }
}
