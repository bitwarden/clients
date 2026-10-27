import { catchError, firstValueFrom, switchMap } from "rxjs";

import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { SdkService } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import type {
  AccessDecisionRequest,
  AccessRequestHistoryQuery,
  AccessRequestId,
  AccessRequestView,
} from "@bitwarden/sdk-internal";

import { ApprovalSdkService } from "../abstractions/approval-sdk.service";

/** The largest page `list_history` accepts; its `pageSize` is documented as 1 to 100. */
const MAX_HISTORY_PAGE_SIZE = 100;

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

  async listApproved(): Promise<AccessRequestView[]> {
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    return firstValueFrom(
      this.sdkService.userClient$(userId).pipe(
        switchMap(async (sdk) => {
          using ref = sdk.take();
          return await ref.value.commercial().pam().approvals().list_approved();
        }),
        catchError((error: unknown) => {
          this.logService.error(`Failed to list the approved access requests: ${error}`);
          throw error;
        }),
      ),
    );
  }

  /**
   * Reads the first page of the ended requests at the largest page size the SDK accepts, with no
   * filters. `total`, `requesters` and `collectionIds` are dropped: nothing here pages or filters
   * yet, so the page's rows alone stand in for the unpaged read this replaced.
   */
  async listHistory(): Promise<AccessRequestView[]> {
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    const query: AccessRequestHistoryQuery = {
      page: 0,
      pageSize: MAX_HISTORY_PAGE_SIZE,
      statuses: [],
      collectionIds: [],
      requesterIds: [],
    };
    return firstValueFrom(
      this.sdkService.userClient$(userId).pipe(
        switchMap(async (sdk) => {
          using ref = sdk.take();
          const page = await ref.value.commercial().pam().approvals().list_history(query);
          return page.requests;
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
