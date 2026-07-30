import { catchError, firstValueFrom, switchMap } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { SdkService } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import type {
  AccessLeaseExtensionRequest,
  AccessLeaseId,
  AccessLeaseRevokeRequest,
  AccessLeaseView,
  AccessRequestView,
} from "@bitwarden/sdk-internal";

import { AccessLeaseSdkService } from "..";

/**
 * SDK-backed implementation of {@link AccessLeaseSdkService}. Lease lifecycle
 * goes through the Rust SDK's `commercial().pam().leases()` client, not
 * hand-rolled HTTP/DTOs. These calls are user-scoped (the requester's own
 * leases), so no `organizationId` is threaded through.
 *
 * Follows the canonical per-call SDK-consumption pattern (see
 * `SendSdkApiService` in `libs/common`): resolve the active user, take a client
 * `Ref` from `SdkService.userClient$`, and dispose it (`using`) once the call
 * settles. Errors surface as-is — the SDK's flat `LeasingError` shape — for
 * callers to interpret via `isLeasingError` (`..`); this service does not wrap
 * or translate them.
 */
export class AccessLeasesSdkService extends AccessLeaseSdkService {
  constructor(
    private sdkService: SdkService,
    private accountService: AccountService,
    private logService: LogService,
  ) {
    super();
  }

  async listMyLeases(): Promise<AccessLeaseView[]> {
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    return firstValueFrom(
      this.sdkService.userClient$(userId).pipe(
        switchMap(async (sdk) => {
          using ref = sdk.take();
          return await ref.value.commercial().pam().leases().list_mine();
        }),
        catchError((error: unknown) => {
          this.logService.error(`Failed to list leases: ${error}`);
          throw error;
        }),
      ),
    );
  }

  async extendLease(
    id: AccessLeaseId,
    request: AccessLeaseExtensionRequest,
  ): Promise<AccessRequestView> {
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    return firstValueFrom(
      this.sdkService.userClient$(userId).pipe(
        switchMap(async (sdk) => {
          using ref = sdk.take();
          return await ref.value.commercial().pam().leases().extend(id, request);
        }),
        catchError((error: unknown) => {
          this.logService.error(`Failed to extend lease: ${error}`);
          throw error;
        }),
      ),
    );
  }

  async endLease(id: AccessLeaseId, request: AccessLeaseRevokeRequest): Promise<void> {
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    await firstValueFrom(
      this.sdkService.userClient$(userId).pipe(
        switchMap(async (sdk) => {
          using ref = sdk.take();
          return await ref.value.commercial().pam().leases().end(id, request);
        }),
        catchError((error: unknown) => {
          this.logService.error(`Failed to end lease: ${error}`);
          throw error;
        }),
      ),
    );
  }
}
