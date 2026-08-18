import { catchError, firstValueFrom, switchMap } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { SdkService } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import type {
  AccessDecisionRequest,
  AccessRequestId,
  AccessRequestView,
} from "@bitwarden/sdk-internal";

import { ApprovalSdkService } from "..";

/**
 * SDK-backed implementation of {@link ApprovalSdkService}. The approver-facing reads and the
 * decide mutation go through the Rust SDK's `commercial().pam().approvals()` client, not
 * hand-rolled HTTP/DTOs.
 *
 * Follows the canonical per-call SDK-consumption pattern (see `SendSdkApiService` in
 * `libs/common`): resolve the active user, take a client `Ref` from `SdkService.userClient$`, and
 * dispose it (`using`) once the call settles. Errors surface as-is; this service does not wrap or
 * translate them.
 */
export class ApprovalsSdkService implements ApprovalSdkService {
  constructor(
    private sdkService: SdkService,
    private accountService: AccountService,
    private logService: LogService,
  ) {}

  async listInbox(): Promise<AccessRequestView[]> {
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    return firstValueFrom(
      this.sdkService.userClient$(userId).pipe(
        switchMap(async (sdk) => {
          using ref = sdk.take();
          return await ref.value.commercial().pam().approvals().list_inbox();
        }),
        catchError((error: unknown) => {
          this.logService.error(`Failed to list the approval inbox: ${error}`);
          throw error;
        }),
      ),
    );
  }

  async listHistory(): Promise<AccessRequestView[]> {
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    return firstValueFrom(
      this.sdkService.userClient$(userId).pipe(
        switchMap(async (sdk) => {
          using ref = sdk.take();
          return await ref.value.commercial().pam().approvals().list_history();
        }),
        catchError((error: unknown) => {
          this.logService.error(`Failed to list the approval history: ${error}`);
          throw error;
        }),
      ),
    );
  }

  async decide(id: AccessRequestId, request: AccessDecisionRequest): Promise<AccessRequestView> {
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    return firstValueFrom(
      this.sdkService.userClient$(userId).pipe(
        switchMap(async (sdk) => {
          using ref = sdk.take();
          return await ref.value.commercial().pam().approvals().decide(id, request);
        }),
        catchError((error: unknown) => {
          // The request may carry an approver-authored comment; never log it.
          this.logService.error(`Failed to record the approval decision: ${error}`);
          throw error;
        }),
      ),
    );
  }
}
