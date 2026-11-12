import { catchError, firstValueFrom, switchMap } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { SdkService } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { UserId } from "@bitwarden/common/types/guid";
import type { PamClient } from "@bitwarden/sdk-internal";

import { describePamError } from "./pam-error-message";

function describeForLog(error: unknown): string {
  const { kind, variant, status, code } = describePamError(error);
  const name = error instanceof Error ? error.name : typeof error;
  return [
    name,
    `kind=${kind}`,
    variant != null ? `variant=${variant}` : undefined,
    status != null ? `status=${status}` : undefined,
    code != null ? `code=${code}` : undefined,
  ]
    .filter((part) => part != null)
    .join(" ");
}

/**
 * The only place in the PAM code that touches the SDK client. Every group calls the SDK through
 * {@link run}, so the client is always taken and released inside the observable, as
 * `SdkService.userClient$` requires.
 */
export class PamSdkService {
  constructor(
    private sdkService: SdkService,
    private accountService: AccountService,
    private logService: LogService,
  ) {}

  /** The id of the active account, rejecting when no one is logged in. */
  async activeUserId(): Promise<UserId> {
    return await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
  }

  /**
   * Runs `fn` against the PAM client of `userId`.
   *
   * A failure is logged as its error name and the catalog-safe fields of `describePamError` (kind,
   * variant, status, code), never the error message, the request or the response body, which can
   * carry server text. It is then rethrown for the caller to decode with `pamErrorMessage`.
   */
  async run<T>(userId: UserId, fn: (pam: PamClient) => Promise<T>): Promise<T> {
    return await firstValueFrom(
      this.sdkService.userClient$(userId).pipe(
        switchMap(async (sdk) => {
          using ref = sdk.take();
          return await fn(ref.value.commercial().pam());
        }),
        catchError((error: unknown) => {
          this.logService.error(`PAM SDK call failed: ${describeForLog(error)}`);
          throw error;
        }),
      ),
    );
  }

  /** {@link run} for the active account. */
  async runAsActiveUser<T>(fn: (pam: PamClient) => Promise<T>): Promise<T> {
    return await this.run(await this.activeUserId(), fn);
  }
}
