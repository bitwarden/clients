import { firstValueFrom } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { ListResponse } from "@bitwarden/common/models/response/list.response";

import { AuditApiService } from "./audit-api.service";
import { AccessAuditEventResponse } from "./responses/access-audit-event.response";

/**
 * `ApiService`-backed {@link AuditApiService}. See the abstraction for why this speaks HTTP rather
 * than SDK, and how far that exception goes.
 *
 * Uses the user-scoped `send` overload rather than the deprecated `authed: true` one, so the request
 * is explicitly authenticated for the active account the rest of this module resolves the same way.
 */
export class DefaultAuditApiService implements AuditApiService {
  constructor(
    private apiService: ApiService,
    private accountService: AccountService,
  ) {}

  async listAccessAuditTrail(organizationId: string): Promise<AccessAuditEventResponse[]> {
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    const response = await this.apiService.send(
      "GET",
      `/organizations/${organizationId}/audit`,
      null,
      userId,
      true,
    );
    return new ListResponse(response, AccessAuditEventResponse).data;
  }
}
