import { catchError, firstValueFrom, switchMap } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { SdkService } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import type { AccessLeaseView, AccessRequestId, AccessRequestView } from "@bitwarden/sdk-internal";

import { AccessRequestSdkService } from "..";

/**
 * SDK-backed implementation of {@link AccessRequestSdkService}. Access-request
 * lifecycle goes through the Rust SDK's `commercial().pam().access_requests()`
 * client, not hand-rolled HTTP/DTOs. These calls are user-scoped (the
 * requester's own requests), so no `organizationId` is threaded through.
 *
 * Follows the canonical per-call SDK-consumption pattern (see
 * `SendSdkApiService` in `libs/common`): resolve the active user, take a client
 * `Ref` from `SdkService.userClient$`, and dispose it (`using`) once the call
 * settles. Errors surface as-is — the SDK's flat `LeasingError` shape — for
 * callers to interpret via `isLeasingError` (`..`); this service does not wrap
 * or translate them.
 */
export class AccessRequestsSdkService extends AccessRequestSdkService {
  constructor(
    private sdkService: SdkService,
    private accountService: AccountService,
    private logService: LogService,
  ) {
    super();
  }

  async listMyAccessRequests(): Promise<AccessRequestView[]> {
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    return firstValueFrom(
      this.sdkService.userClient$(userId).pipe(
        switchMap(async (sdk) => {
          using ref = sdk.take();
          return await ref.value.commercial().pam().access_requests().list_mine();
        }),
        catchError((error: unknown) => {
          this.logService.error(`Failed to list access requests: ${error}`);
          throw error;
        }),
      ),
    );
  }

  async getAccessRequest(id: AccessRequestId): Promise<AccessRequestView> {
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    return firstValueFrom(
      this.sdkService.userClient$(userId).pipe(
        switchMap(async (sdk) => {
          using ref = sdk.take();
          return await ref.value.commercial().pam().access_requests().get(id);
        }),
        catchError((error: unknown) => {
          this.logService.error(`Failed to get access request: ${error}`);
          throw error;
        }),
      ),
    );
  }

  async activateAccessRequest(id: AccessRequestId): Promise<AccessLeaseView> {
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    return firstValueFrom(
      this.sdkService.userClient$(userId).pipe(
        switchMap(async (sdk) => {
          using ref = sdk.take();
          return await ref.value.commercial().pam().access_requests().activate(id);
        }),
        catchError((error: unknown) => {
          this.logService.error(`Failed to activate access request: ${error}`);
          throw error;
        }),
      ),
    );
  }

  async cancelAccessRequest(id: AccessRequestId): Promise<void> {
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    await firstValueFrom(
      this.sdkService.userClient$(userId).pipe(
        switchMap(async (sdk) => {
          using ref = sdk.take();
          return await ref.value.commercial().pam().access_requests().cancel(id);
        }),
        catchError((error: unknown) => {
          this.logService.error(`Failed to cancel access request: ${error}`);
          throw error;
        }),
      ),
    );
  }
}
