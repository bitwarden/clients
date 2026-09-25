import { catchError, firstValueFrom, switchMap } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { asUuid, SdkService } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import type {
  AccessLeaseView,
  AccessPreCheckView,
  AccessRequestCreateRequest,
  AccessRequestId,
  AccessRequestResultView,
  AccessRequestView,
  CipherAccessStateView,
  CipherId as SdkCipherId,
} from "@bitwarden/sdk-internal";

import { AccessRequestSdkService } from "..";

/**
 * SDK-backed implementation of {@link AccessRequestSdkService}. Access-request lifecycle goes
 * through the Rust SDK's `commercial().pam().access_requests()` client, not hand-rolled
 * HTTP/DTOs; these calls are user-scoped, so no `organizationId` is threaded through.
 *
 * Follows the canonical per-call SDK-consumption pattern: resolve the active user, take a
 * client `Ref` from `SdkService.userClient$`, and dispose it (`using`) once the call settles.
 * Errors surface as-is, for callers to interpret via `isLeasingError`.
 */
export class AccessRequestsSdkService implements AccessRequestSdkService {
  /**
   * Reads for the same cipher that are still in flight, so concurrent callers share one SDK
   * round trip — several surfaces (the vault-row badge, the sidebar's narrowing) ask about the
   * same row in the same render pass, and the SDK caches nothing.
   *
   * Entries drop the moment the read settles, collapsing simultaneous duplicates without ever
   * serving a stale access state.
   */
  private readonly cipherAccessStateReads = new Map<string, Promise<CipherAccessStateView>>();

  constructor(
    private sdkService: SdkService,
    private accountService: AccountService,
    private logService: LogService,
  ) {}

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

  getCipherAccessState(cipherId: string): Promise<CipherAccessStateView> {
    const inFlight = this.cipherAccessStateReads.get(cipherId);
    if (inFlight != null) {
      return inFlight;
    }

    const read = this.readCipherAccessState(cipherId).finally(() =>
      this.cipherAccessStateReads.delete(cipherId),
    );
    this.cipherAccessStateReads.set(cipherId, read);
    return read;
  }

  private async readCipherAccessState(cipherId: string): Promise<CipherAccessStateView> {
    const id = asUuid<SdkCipherId>(cipherId);
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    return firstValueFrom(
      this.sdkService.userClient$(userId).pipe(
        switchMap(async (sdk) => {
          using ref = sdk.take();
          return await ref.value.commercial().pam().access_requests().cipher_access_state(id);
        }),
        catchError((error: unknown) => {
          this.logService.error(`Failed to get cipher access state: ${error}`);
          throw error;
        }),
      ),
    );
  }

  async preCheck(cipherId: string): Promise<AccessPreCheckView> {
    const id = asUuid<SdkCipherId>(cipherId);
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    return firstValueFrom(
      this.sdkService.userClient$(userId).pipe(
        switchMap(async (sdk) => {
          using ref = sdk.take();
          return await ref.value.commercial().pam().access_requests().pre_check(id);
        }),
        catchError((error: unknown) => {
          this.logService.error(`Failed to pre-check cipher access: ${error}`);
          throw error;
        }),
      ),
    );
  }

  async submitAccessRequest(
    cipherId: string,
    request: AccessRequestCreateRequest,
  ): Promise<AccessRequestResultView> {
    const id = asUuid<SdkCipherId>(cipherId);
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    return firstValueFrom(
      this.sdkService.userClient$(userId).pipe(
        switchMap(async (sdk) => {
          using ref = sdk.take();
          return await ref.value.commercial().pam().access_requests().request(id, request);
        }),
        catchError((error: unknown) => {
          // The request payload carries a user-authored justification; never log it.
          this.logService.error(`Failed to submit access request: ${error}`);
          throw error;
        }),
      ),
    );
  }
}
