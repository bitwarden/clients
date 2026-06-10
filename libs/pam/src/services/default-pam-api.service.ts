import { merge, Observable, of, Subject, switchMap } from "rxjs";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { ErrorResponse } from "@bitwarden/common/models/response/error.response";
import { ListResponse } from "@bitwarden/common/models/response/list.response";
import { CipherResponse } from "@bitwarden/common/vault/models/response/cipher.response";

import { GatedCipherFetchResult } from "../abstractions/gated-cipher-fetch-result";
import { LeaseEventService } from "../abstractions/lease-event.service";
import { CipherAccessState, PamApiService } from "../abstractions/pam-api.service";
import { AccessPreCheckResponse } from "../abstractions/responses/access-pre-check.response";
import { AccessRequestEnvelopeResponse } from "../abstractions/responses/access-request-envelope.response";
import { AccessRequestResponse } from "../abstractions/responses/access-request.response";
import { AccessRuleResponse } from "../abstractions/responses/access-rule.response";
import { BulkRevokeResult } from "../abstractions/responses/bulk-revoke.result";
import { CipherLeaseStateResponse } from "../abstractions/responses/cipher-lease-state.response";
import { OrganizationGovernanceSummaryResponse } from "../abstractions/responses/governance-summary.response";
import { InboxAccessRequestResponse } from "../abstractions/responses/inbox-access-request.response";
import { LeaseResponse } from "../abstractions/responses/lease.response";

import { AccessRequestPatchRequest } from "./requests/access-request-patch.request";
import { AccessRuleRequest } from "./requests/access-rule.request";
import { CreateLeaseRequest } from "./requests/create-lease.request";
import { LeaseDecisionRequest } from "./requests/lease-decision.request";
import { LeaseExtensionRequest } from "./requests/lease-extension.request";
import { LeaseRevokeRequest } from "./requests/lease-revoke.request";

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export class DefaultPamApiService implements PamApiService {
  /**
   * Pumped after every successful mutation so that any active
   * `getCipherAccessState$` subscriber re-fetches its snapshot. Mirrors what
   * the in-memory mock does via `store.events$` — the real push channel
   * (`LeaseEventService`) only fires for backend-driven transitions, so
   * locally-initiated mutations need their own refresh signal.
   */
  protected readonly localRefresh$ = new Subject<void>();

  readonly mutations$: Observable<void> = this.localRefresh$.asObservable();

  constructor(
    private apiService: ApiService,
    private leaseEvents: LeaseEventService,
  ) {}

  // TODO(PM-37264): implement the cipher-fetch transport. ApiService.send is
  // unsuitable here because it rejects every non-200 via ErrorResponse (dropping
  // the response body — so a 202 carrying a AccessRequest can't be reconstructed)
  // and calls logoutCallback("invalidAccessToken") on any authenticated 403,
  // which would log the user out on every "denied" verdict.
  fetchGatedCipher(_id: string): Promise<GatedCipherFetchResult> {
    return Promise.reject(new Error("fetchGatedCipher is not implemented yet; see PM-37264"));
  }

  getCipherAccessState$(cipherId: string, _userId: string): Observable<CipherAccessState> {
    // Re-fetch on (a) initial subscription, (b) any lease event from the push
    // channel, and (c) any local mutation. Mirrors the mock's
    // `store.events$.pipe(map(snapshot), startWith(snapshot))` semantics.
    return merge(of(undefined), this.leaseEvents.allEvents$(), this.localRefresh$).pipe(
      switchMap(() => this.fetchCipherAccessState(cipherId)),
    );
  }

  private async fetchCipherAccessState(cipherId: string): Promise<CipherAccessState> {
    try {
      const raw = await this.send("GET", `/ciphers/${cipherId}/lease/state`, null, true);
      const envelope = new CipherLeaseStateResponse(raw);
      return {
        lease: {
          activeLease: envelope.activeLease ?? undefined,
          pendingRequest: envelope.pendingRequest ?? undefined,
          approvedTicket: envelope.approvedTicket ?? undefined,
        },
      };
    } catch (e) {
      // 404 = cipher not gated / PAM flag off (spec §2). The banner should
      // render inert; treat as an empty snapshot rather than surfacing the
      // error to the consumer.
      if (e instanceof ErrorResponse && e.statusCode === 404) {
        return { lease: {} };
      }
      throw e;
    }
  }

  async getLeasePreCheck(cipherId: string): Promise<AccessPreCheckResponse> {
    return new AccessPreCheckResponse(
      await this.send("GET", `/ciphers/${cipherId}/lease/pre-check`, null, true),
    );
  }

  async requestLease(
    cipherId: string,
    body: CreateLeaseRequest,
  ): Promise<AccessRequestEnvelopeResponse> {
    const response = new AccessRequestEnvelopeResponse(
      await this.send("POST", `/ciphers/${cipherId}/lease`, body, true),
    );
    this.localRefresh$.next();
    return response;
  }

  async getLeasedCipher(cipherId: string): Promise<CipherResponse> {
    return new CipherResponse(
      await this.send("GET", `/ciphers/${cipherId}/lease/cipher`, null, true),
    );
  }

  async listInboxRequests(): Promise<InboxAccessRequestResponse[]> {
    const r = await this.send("GET", "/leasing/inbox/requests", null, true);
    return new ListResponse(r, InboxAccessRequestResponse).data;
  }

  async listInboxHistory(): Promise<InboxAccessRequestResponse[]> {
    const r = await this.send("GET", "/leasing/inbox/history", null, true);
    return new ListResponse(r, InboxAccessRequestResponse).data;
  }

  async listMyRequests(): Promise<AccessRequestResponse[]> {
    const r = await this.send("GET", "/leasing/requests/mine", null, true);
    return new ListResponse(r, AccessRequestResponse).data;
  }

  async listActiveLeases(): Promise<LeaseResponse[]> {
    const r = await this.send("GET", "/leasing/leases/mine/active", null, true);
    return new ListResponse(r, LeaseResponse).data;
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

  async patchAccessRequest(
    id: string,
    request: AccessRequestPatchRequest,
  ): Promise<AccessRequestResponse> {
    const response = new AccessRequestResponse(
      await this.send("PATCH", `/leasing/requests/${id}`, request, true),
    );
    this.localRefresh$.next();
    return response;
  }

  async cancelAccessRequest(id: string): Promise<void> {
    await this.send("DELETE", `/leasing/requests/${id}`, null, false);
    this.localRefresh$.next();
  }

  async requestLeaseExtension(request: LeaseExtensionRequest): Promise<AccessRequestResponse> {
    const response = new AccessRequestResponse(
      await this.send("POST", "/leasing/requests/extension", request, true),
    );
    this.localRefresh$.next();
    return response;
  }

  async decideAccessRequest(
    id: string,
    request: LeaseDecisionRequest,
  ): Promise<AccessRequestResponse> {
    const response = new AccessRequestResponse(
      await this.send("POST", `/leasing/requests/${id}/decision`, request, true),
    );
    this.localRefresh$.next();
    return response;
  }

  async startLease(requestId: string): Promise<LeaseResponse> {
    const response = new LeaseResponse(
      await this.send("POST", `/leasing/requests/${requestId}/start`, null, true),
    );
    this.localRefresh$.next();
    return response;
  }

  async revokeLease(id: string, request: LeaseRevokeRequest): Promise<void> {
    await this.send("POST", `/leasing/leases/${id}/revoke`, request, false);
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
