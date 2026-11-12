import { catchError, firstValueFrom, switchMap } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { SdkService } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { UserId } from "@bitwarden/common/types/guid";
import type { PamClient } from "@bitwarden/sdk-internal";

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
   * A failure is logged as `${error}` only, which is the error's name and message, never the
   * request or the response, and is then rethrown for the caller to decode with `pamErrorMessage`.
   */
  async run<T>(userId: UserId, fn: (pam: PamClient) => Promise<T>): Promise<T> {
    return await firstValueFrom(
      this.sdkService.userClient$(userId).pipe(
        switchMap(async (sdk) => {
          using ref = sdk.take();
          return await fn(ref.value.commercial().pam());
        }),
        catchError((error: unknown) => {
          this.logService.error(`PAM SDK call failed: ${error}`);
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
