import type {
  AccessAuditEventKind,
  AccessAuditEventResponse,
} from "./responses/access-audit-event.response";
import type { AccessAuditItemResponse } from "./responses/access-audit-item.response";

/**
 * What one read of the trail is narrowed to. Every dimension is optional; an unset one matches
 * everything, so an empty filter still reads one page, newest first.
 *
 * List dimensions are OR-ed within, AND-ed across, mirroring the multi-select chips driving them.
 */
export type AuditTrailFilter = {
  /** Inclusive lower bound. Absent reaches back as far as the server's retention window allows. */
  start?: Date;
  /** Inclusive upper bound. Absent reaches up to now. */
  end?: Date;
  kinds?: readonly AccessAuditEventKind[];
  actorIds?: readonly string[];
  /**
   * Whether to also include the system / automatic events, which have no actor id to be selected by.
   * Unions with {@link actorIds} rather than narrowing it.
   */
  includeAutomatedActor?: boolean;
  requesterIds?: readonly string[];
  /**
   * The subject credentials and access rules to keep. These two UNION rather than narrow — the one
   * place two dimensions here are OR-ed, since a rule-administration event has a rule but no cipher.
   */
  cipherIds?: readonly string[];
  ruleIds?: readonly string[];
  /** Where the previous page stopped, as that page reported it. Absent starts at the newest event. */
  continuationToken?: string;
};

/**
 * One page of the trail. `continuationToken` is set while more pages remain, null on the last —
 * the caller's stop condition.
 */
export type AuditTrailPage = {
  data: AccessAuditEventResponse[];
  continuationToken: string | null;
};

/**
 * The one governance-facing read of the PAM access-audit trail, as raw HTTP.
 *
 * The one exception to this module's SDK-only rule: the server implements this endpoint, but the
 * pinned SDK's `pam()` client has no audit module, so there is no SDK call to make. Bound behind
 * an abstraction so the eventual swap is a provider change in `provide-pam.ts`.
 *
 * Closing this exception is SDK work — see this directory's README.
 */
export abstract class AuditApiService {
  /**
   * `GET /organizations/{orgId}/audit` — one page of the organization's access-audit trail, newest
   * first, narrowed by `filter`, with each action's before/after pair collapsed to one entry.
   *
   * Bounded: returns a page and a resume token, and filters server-side, so a narrowed request
   * comes back complete, not just complete-within-the-page.
   *
   * Org-scoped, authorized by AccessEventLogs regardless of which collections the caller manages;
   * a caller without that permission gets a 404, not an empty list.
   */
  abstract listAccessAuditTrail(
    organizationId: string,
    filter?: AuditTrailFilter,
  ): Promise<AuditTrailPage>;

  /**
   * `GET /organizations/{orgId}/audit/items` — the distinct subjects the trail names in the given
   * range, one entry per subject, for the Item filter's menu.
   *
   * Comes from the server since neither obvious source works: a trail page names only some items
   * in range, and this vault holds credentials the trail never mentions.
   *
   * Unpaged and bounded by how many credentials and rules the organization governs, not by
   * activity volume; same authorization as the trail.
   */
  abstract listAccessAuditItems(
    organizationId: string,
    range?: { start?: Date; end?: Date },
  ): Promise<AccessAuditItemResponse[]>;
}
