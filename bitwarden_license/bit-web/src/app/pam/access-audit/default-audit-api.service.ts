import { firstValueFrom } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { AccountService } from "@bitwarden/common/auth/abstractions/account.service";
import { getUserId } from "@bitwarden/common/auth/services/account.service";
import { ListResponse } from "@bitwarden/common/models/response/list.response";

import { AuditApiService, AuditTrailFilter, AuditTrailPage } from "./audit-api.service";
import { AccessAuditEventResponse } from "./responses/access-audit-event.response";
import { AccessAuditItemResponse } from "./responses/access-audit-item.response";

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

/**
 * The filter as the endpoint's query parameters, or the empty string when nothing is set.
 *
 * A multi-select dimension is spelled as a repeated key (`?kind=a&kind=b`), which is what the
 * server's array binding reads; an unset one is omitted entirely rather than sent empty, because an
 * empty list there would mean "match nothing" instead of "no filter". Bounds go over as ISO instants
 * so the server reads the same moment the auditor picked, whatever timezone either end sits in.
 */
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
