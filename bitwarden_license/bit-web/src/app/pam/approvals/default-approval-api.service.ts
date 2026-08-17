import { firstValueFrom } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { ListResponse } from "@bitwarden/common/models/response/list.response";
import { uuidAsString } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";

import type { AccessRequestId } from "../abstractions/access-lease";

import type { AccessDecisionRequest } from "./access-decision.request";
import { ApprovalApiService } from "./approval-api.service";
import { AccessRequestDetailsResponse } from "./responses/access-request.response";

/**
 * `ApiService`-backed {@link ApprovalApiService} — the only place in this module that speaks HTTP
 * rather than SDK. See the abstraction for why this exception exists and how far it goes.
 *
 * Uses the user-scoped `send` overload rather than the deprecated `authed: true` one, so the request
 * is explicitly authenticated for the active account the rest of this module resolves the same way.
 */
export class DefaultApprovalApiService implements ApprovalApiService {
  constructor(
    private apiService: ApiService,
    private accountService: AccountService,
  ) {}

  async listInbox(): Promise<AccessRequestDetailsResponse[]> {
    return await this.list("/access-requests/inbox");
  }

  async listHistory(): Promise<AccessRequestDetailsResponse[]> {
    return await this.list("/access-requests/history");
  }

  async decide(
    id: AccessRequestId,
    request: AccessDecisionRequest,
  ): Promise<AccessRequestDetailsResponse> {
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    const response = await this.apiService.send(
      "POST",
      `/access-requests/${uuidAsString(id)}/decision`,
      request,
      userId,
      true,
    );
    return new AccessRequestDetailsResponse(response);
  }

  private async list(path: string): Promise<AccessRequestDetailsResponse[]> {
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    const response = await this.apiService.send("GET", path, null, userId, true);
    return new ListResponse(response, AccessRequestDetailsResponse).data;
  }
}
