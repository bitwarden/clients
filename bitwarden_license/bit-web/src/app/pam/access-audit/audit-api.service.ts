import type {
  AccessAuditEventKind,
  AccessAuditEventResponse,
} from "./responses/access-audit-event.response";
import type { AccessAuditItemResponse } from "./responses/access-audit-item.response";

/**
 * An unset dimension matches everything. List dimensions are OR-ed within and AND-ed across, like
 * the multi-select chips driving them.
 */
export type AuditTrailFilter = {
  /** Inclusive. Absent reaches back to the server's retention window. */
  start?: Date;
  /** Inclusive. Absent reaches up to now. */
  end?: Date;
  kinds?: readonly AccessAuditEventKind[];
  actorIds?: readonly string[];
  /** Also matches system events, which have no actor id; unions with {@link actorIds}. */
  includeAutomatedActor?: boolean;
  requesterIds?: readonly string[];
  /**
   * Unlike the other dimensions, these two are OR-ed with each other, since a rule administration
   * event names a rule but no cipher.
   */
  cipherIds?: readonly string[];
  ruleIds?: readonly string[];
  /** As the previous page reported it. Absent starts at the newest event. */
  continuationToken?: string;
};

/** `continuationToken` is set while more pages remain and null on the last. */
export type AuditTrailPage = {
  data: AccessAuditEventResponse[];
  continuationToken: string | null;
};

/**
 * Reads the PAM access-audit trail over raw HTTP, since the SDK has no audit client yet. See this
 * directory's README for the SDK follow-up.
 */
export abstract class AuditApiService {
  /**
   * `GET /organizations/{orgId}/audit`: one page, newest first, filtered server-side, with each
   * action's attempt and outcome collapsed to one entry. A caller without AccessEventLogs gets a
   * 403, not an empty list.
   */
  abstract listAccessAuditTrail(
    organizationId: string,
    filter?: AuditTrailFilter,
  ): Promise<AuditTrailPage>;

  /**
   * `GET /organizations/{orgId}/audit/items`: the distinct subjects the trail names in range, for
   * the Item filter. A trail page names only some, and the vault holds items the trail never names.
   */
  abstract listAccessAuditItems(
    organizationId: string,
    range?: { start?: Date; end?: Date },
  ): Promise<AccessAuditItemResponse[]>;
}
