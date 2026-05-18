import { CollectionLeasingRequest } from "../services/requests/collection-leasing.request";
import { LeaseDecisionRequest } from "../services/requests/lease-decision.request";
import { LeaseExtensionRequest } from "../services/requests/lease-extension.request";
import { LeaseRequestPatchRequest } from "../services/requests/lease-request-patch.request";
import { LeaseRevokeRequest } from "../services/requests/lease-revoke.request";

import { GatedCipherFetchResult } from "./gated-cipher-fetch-result";
import { CollectionLeasingConfigResponse } from "./responses/collection-leasing.response";
import { InboxBadgeCountResponse } from "./responses/inbox-badge-count.response";
import { InboxLeaseRequestResponse } from "./responses/inbox-lease-request.response";
import { LeaseRequestResponse } from "./responses/lease-request.response";

export abstract class PamApiService {
  abstract fetchGatedCipher(id: string): Promise<GatedCipherFetchResult>;
  abstract patchLeaseRequest(
    id: string,
    request: LeaseRequestPatchRequest,
  ): Promise<LeaseRequestResponse>;
  abstract cancelLeaseRequest(id: string): Promise<void>;
  abstract requestLeaseExtension(request: LeaseExtensionRequest): Promise<LeaseRequestResponse>;
  abstract decideLeaseRequest(
    id: string,
    request: LeaseDecisionRequest,
  ): Promise<LeaseRequestResponse>;
  abstract revokeLease(id: string, request: LeaseRevokeRequest): Promise<void>;
  abstract setCollectionLeasingConfig(
    id: string,
    request: CollectionLeasingRequest,
  ): Promise<CollectionLeasingConfigResponse>;
  /**
   * List pending lease requests for collections the caller can Manage.
   * Server filters by the caller's permissions; the frontend never decides
   * who an approver is.
   */
  abstract listInboxRequests(): Promise<InboxLeaseRequestResponse[]>;
  /**
   * Submit an approve/deny decision for a single lease request.
   * Convenience wrapper around the existing decision endpoint, named to
   * match the inbox interaction.
   */
  abstract submitDecision(
    requestId: string,
    request: LeaseDecisionRequest,
  ): Promise<LeaseRequestResponse>;
  /**
   * Pending lease-request count visible to the caller, for the nav badge.
   */
  abstract getInboxBadgeCount(): Promise<InboxBadgeCountResponse>;
  /**
   * Fetch a single lease request by ID. Used by the email deep-link route so
   * the locked-vault approval surface can render request details without
   * decrypting any vault data.
   */
  abstract getLeaseRequest(id: string): Promise<InboxLeaseRequestResponse>;
}
