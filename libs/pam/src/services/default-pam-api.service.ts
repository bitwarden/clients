import { concat, from, merge, Observable, of, Subject, switchMap, timer } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { ListResponse } from "@bitwarden/common/models/response/list.response";
import { CipherResponse } from "@bitwarden/common/vault/models/response/cipher.response";

import { AccessEventService } from "../abstractions/access-event.service";
import { CipherAccessState, PamApiService } from "../abstractions/pam-api.service";
import { AccessLeaseResponse } from "../abstractions/responses/access-lease.response";
import { AccessPreCheckResponse } from "../abstractions/responses/access-pre-check.response";
import { AccessRequestDetailsResponse } from "../abstractions/responses/access-request-details.response";
import { AccessRequestResultResponse } from "../abstractions/responses/access-request-result.response";
import { AccessRuleResponse } from "../abstractions/responses/access-rule.response";
import { BulkRevokeResult } from "../abstractions/responses/bulk-revoke.result";
import { CipherAccessStateResponse } from "../abstractions/responses/cipher-access-state.response";
import { OrganizationGovernanceSummaryResponse } from "../abstractions/responses/governance-summary.response";

import { AccessDecisionRequest } from "./requests/access-decision.request";
import { AccessLeaseExtensionRequest } from "./requests/access-lease-extension.request";
import { AccessLeaseRevokeRequest } from "./requests/access-lease-revoke.request";
import { AccessRequestCreateRequest } from "./requests/access-request-create.request";
import { AccessRuleRequest } from "./requests/access-rule.request";

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export class DefaultPamApiService implements PamApiService {
  /**
   * Pumped after every successful mutation so that any active
   * `getCipherAccessState$` subscriber re-fetches its snapshot. Mirrors what
   * the in-memory mock does via `store.events$` — the real push channel
   * (`AccessEventService`) only fires for backend-driven transitions, so
   * locally-initiated mutations need their own refresh signal.
   */
  protected readonly localRefresh$ = new Subject<void>();

  readonly mutations$: Observable<void> = this.localRefresh$.asObservable();

  constructor(
    private apiService: ApiService,
    private accessEvents: AccessEventService,
  ) {}

  getCipherAccessState$(cipherId: string, _userId: string): Observable<CipherAccessState> {
    // Re-fetch on (a) initial subscription, (b) any access-change push from the
    // server (decide / activate / revoke / extend / cancel), and (c) any local
    // mutation. Each fetch additionally arms a timer at the active lease's
    // `notAfter`, so a lazily-expiring lease re-locks without a server push.
    return merge(of(undefined), this.accessEvents.accessChanged$(), this.localRefresh$).pipe(
      switchMap(() => this.fetchWithExpiry$(cipherId)),
    );
  }

  /**
   * Fetches the access-state snapshot and, when it carries a live lease, schedules
   * a single re-fetch at the lease's `notAfter`. Expiry is lazy server-side (no
   * push fires when a lease lapses), so without this timer an open cipher would
   * keep showing its secrets past the window. The re-fetch returns no active lease
   * (the server filters expired leases), which drives banners, row badges, and the
   * open cipher dialog to re-lock on their own.
   */
  private fetchWithExpiry$(cipherId: string): Observable<CipherAccessState> {
    return from(this.fetchCipherAccessState(cipherId)).pipe(
      switchMap((state) => {
        const notAfter = state.activeLease?.notAfter;
        const untilExpiryMs = notAfter != null ? Date.parse(notAfter) - Date.now() : -1;
        return untilExpiryMs > 0
          ? concat(
              of(state),
              timer(untilExpiryMs).pipe(switchMap(() => this.fetchWithExpiry$(cipherId))),
            )
          : of(state);
      }),
    );
  }

  private async fetchCipherAccessState(cipherId: string): Promise<CipherAccessState> {
    try {
      const raw = await this.send("GET", `/ciphers/${cipherId}/lease/state`, null, true);
      const snapshot = new CipherAccessStateResponse(raw);
      return {
        activeLease: snapshot.activeLease ?? undefined,
        pendingRequest: snapshot.pendingRequest ?? undefined,
        approvedRequest: snapshot.approvedRequest ?? undefined,
        extensionsAllowed: snapshot.extensionsAllowed,
        maxExtensionDurationSeconds: snapshot.maxExtensionDurationSeconds,
      };
    } catch (e) {
      // 404 = cipher not gated / PAM flag off (spec §2). The banner should
      // render inert; treat as an empty snapshot rather than surfacing the
      // error to the consumer.
      if (e instanceof ErrorResponse && e.statusCode === 404) {
        return {};
      }
      throw e;
    }
  }

  async getAccessPreCheck(cipherId: string): Promise<AccessPreCheckResponse> {
    return new AccessPreCheckResponse(
      await this.send("GET", `/ciphers/${cipherId}/lease/pre-check`, null, true),
    );
  }

  async submitAccessRequest(
    cipherId: string,
    body: AccessRequestCreateRequest,
  ): Promise<AccessRequestResultResponse> {
    const response = new AccessRequestResultResponse(
      await this.send("POST", `/ciphers/${cipherId}/lease`, body, true),
    );
    this.localRefresh$.next();
    return response;
  }

  // DEPRECATED: GET /ciphers/{id}/lease/cipher is scheduled for removal; kept functional. See PamApiService.getLeasedCipher.
  async getLeasedCipher(cipherId: string): Promise<CipherResponse> {
    return new CipherResponse(
      await this.send("GET", `/ciphers/${cipherId}/lease/cipher`, null, true),
    );
  }

  async listInboxRequests(): Promise<AccessRequestDetailsResponse[]> {
    const r = await this.send("GET", "/access-requests/inbox", null, true);
    return new ListResponse(r, AccessRequestDetailsResponse).data;
  }

  async listInboxHistory(): Promise<AccessRequestDetailsResponse[]> {
    const r = await this.send("GET", "/access-requests/history", null, true);
    return new ListResponse(r, AccessRequestDetailsResponse).data;
  }

  async listMyAccessRequests(): Promise<AccessRequestDetailsResponse[]> {
    const r = await this.send("GET", "/access-requests/mine", null, true);
    return new ListResponse(r, AccessRequestDetailsResponse).data;
  }

  async listActiveLeases(): Promise<AccessLeaseResponse[]> {
    const r = await this.send("GET", "/leases/mine", null, true);
    return new ListResponse(r, AccessLeaseResponse).data;
  }

  async listManagedActiveLeases(): Promise<AccessLeaseResponse[]> {
    const r = await this.send("GET", "/leases/active", null, true);
    return new ListResponse(r, AccessLeaseResponse).data;
  }

  async listManagedLeaseHistory(): Promise<AccessLeaseResponse[]> {
    const r = await this.send("GET", "/leases/history", null, true);
    return new ListResponse(r, AccessLeaseResponse).data;
  }

  getGovernanceSummary(_organizationId: string): Promise<OrganizationGovernanceSummaryResponse> {
    return Promise.reject(new Error("getGovernanceSummary is not implemented yet"));
  }

  bulkRevokeLeases(_organizationId: string, _blockNewLeases: boolean): Promise<BulkRevokeResult> {
    return Promise.reject(new Error("bulkRevokeLeases is not implemented yet"));
  }

  unblockNewLeases(_organizationId: string): Promise<void> {
    return Promise.reject(new Error("unblockNewLeases is not implemented yet"));
  }

  isLeasingFrozen(_organizationId: string): Promise<boolean> {
    return Promise.reject(new Error("isLeasingFrozen is not implemented yet"));
  }

  async cancelAccessRequest(id: string): Promise<void> {
    await this.send("POST", `/access-requests/${id}/revoke`, null, false);
    this.localRefresh$.next();
  }

  async requestLeaseExtension(
    leaseId: string,
    request: AccessLeaseExtensionRequest,
  ): Promise<AccessRequestDetailsResponse> {
    const response = new AccessRequestDetailsResponse(
      await this.send("POST", `/leases/${leaseId}/extend`, request, true),
    );
    this.localRefresh$.next();
    return response;
  }

  async decideAccessRequest(
    id: string,
    request: AccessDecisionRequest,
  ): Promise<AccessRequestDetailsResponse> {
    const response = new AccessRequestDetailsResponse(
      await this.send("POST", `/access-requests/${id}/decision`, request, true),
    );
    this.localRefresh$.next();
    return response;
  }

  async activateLease(requestId: string): Promise<AccessLeaseResponse> {
    const response = new AccessLeaseResponse(
      await this.send("POST", `/access-requests/${requestId}/activate`, null, true),
    );
    this.localRefresh$.next();
    return response;
  }

  async revokeAccessLease(id: string, request: AccessLeaseRevokeRequest): Promise<void> {
    await this.send("POST", `/leases/${id}/revoke`, request, false);
    this.localRefresh$.next();
  }

  async listAccessRules(organizationId: string): Promise<ListResponse<AccessRuleResponse>> {
    const r = await this.send("GET", `/organizations/${organizationId}/access-rules`, null, true);
    return new ListResponse(r, AccessRuleResponse);
  }

  async getAccessRule(organizationId: string, id: string): Promise<AccessRuleResponse> {
    return new AccessRuleResponse(
      await this.send("GET", `/organizations/${organizationId}/access-rules/${id}`, null, true),
    );
  }

  async createAccessRule(
    organizationId: string,
    request: AccessRuleRequest,
  ): Promise<AccessRuleResponse> {
    return new AccessRuleResponse(
      await this.send("POST", `/organizations/${organizationId}/access-rules`, request, true),
    );
  }

  async updateAccessRule(
    organizationId: string,
    id: string,
    request: AccessRuleRequest,
  ): Promise<AccessRuleResponse> {
    return new AccessRuleResponse(
      await this.send("PUT", `/organizations/${organizationId}/access-rules/${id}`, request, true),
    );
  }

  async deleteAccessRule(organizationId: string, id: string): Promise<void> {
    await this.send("DELETE", `/organizations/${organizationId}/access-rules/${id}`, null, false);
  }

  private send(method: HttpMethod, path: string, body: unknown, hasResponse: boolean) {
    return this.apiService.send(method, path, body, true, hasResponse);
  }
}
