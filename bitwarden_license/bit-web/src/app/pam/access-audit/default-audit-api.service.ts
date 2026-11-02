import { firstValueFrom } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { ListResponse } from "@bitwarden/common/models/response/list.response";

import { AuditApiService, AuditTrailFilter, AuditTrailPage } from "./audit-api.service";
import { AccessAuditEventResponse } from "./responses/access-audit-event.response";
import { AccessAuditItemResponse } from "./responses/access-audit-item.response";

/** See {@link AuditApiService} for why this speaks HTTP rather than SDK. */
export class DefaultAuditApiService implements AuditApiService {
  constructor(
    private apiService: ApiService,
    private accountService: AccountService,
  ) {}

  async listAccessAuditTrail(
    organizationId: string,
    filter: AuditTrailFilter = {},
  ): Promise<AuditTrailPage> {
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    const response = await this.apiService.send(
      "GET",
      `/organizations/${organizationId}/audit${toQueryString(filter)}`,
      null,
      userId,
      true,
    );
    const list = new ListResponse(response, AccessAuditEventResponse);
    return { data: list.data, continuationToken: list.continuationToken ?? null };
  }

  async listAccessAuditItems(
    organizationId: string,
    range: { start?: Date; end?: Date } = {},
  ): Promise<AccessAuditItemResponse[]> {
    const userId = await firstValueFrom(this.accountService.activeAccount$.pipe(getUserId));
    const response = await this.apiService.send(
      "GET",
      `/organizations/${organizationId}/audit/items${toQueryString(range)}`,
      null,
      userId,
      true,
    );
    return new ListResponse(response, AccessAuditItemResponse).data;
  }
}

function toQueryString(filter: AuditTrailFilter): string {
  const params = new URLSearchParams();
  const append = (key: string, values: readonly string[] | undefined) =>
    values?.forEach((value) => params.append(key, value));

  if (filter.start != null) {
    params.append("start", filter.start.toISOString());
  }
  if (filter.end != null) {
    params.append("end", filter.end.toISOString());
  }
  append("kind", filter.kinds);
  append("actorId", filter.actorIds);
  if (filter.includeAutomatedActor) {
    params.append("includeAutomatedActor", "true");
  }
  append("requesterId", filter.requesterIds);
  append("cipherId", filter.cipherIds);
  append("ruleId", filter.ruleIds);
  if (filter.continuationToken != null) {
    params.append("continuationToken", filter.continuationToken);
  }

  const query = params.toString();
  return query === "" ? "" : `?${query}`;
}
