import type {
  AccessAuditEventKind,
  AccessAuditEventResponse,
} from "./responses/access-audit-event.response";
import type { AccessAuditItemResponse } from "./responses/access-audit-item.response";

/**
 * What one read of the trail is narrowed to. Every dimension is optional and an unset one matches
 * everything, so an empty filter still reads the trail — one page of it, newest first.
 *
 * The identity and kind dimensions are lists because the chips driving them are multi-select: values
 * within a dimension are OR-ed, dimensions are AND-ed together.
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
   * The subject credentials and access rules to keep. These two UNION with each other rather than
   * narrowing — the one place two dimensions here are OR-ed. They are the halves of a single Item
   * selection, and a rule-administration event names a rule and no cipher, so asking for a credential
   * and a rule together must mean either rather than the empty intersection.
   */
  cipherIds?: readonly string[];
  ruleIds?: readonly string[];
  /** Where the previous page stopped, as that page reported it. Absent starts at the newest event. */
  continuationToken?: string;
};

/**
 * One page of the trail. `continuationToken` is set while more pages remain and null on the last one,
 * so a caller walking the whole trail stops when it goes null rather than by counting.
 */
export type AuditTrailPage = {
  data: AccessAuditEventResponse[];
  continuationToken: string | null;
};

/**
 * The one governance-facing read of the PAM access-audit trail, as raw HTTP.
 *
 * The one exception to this module's rule that PAM calls go through the Rust SDK. The server
 * implements `GET /organizations/{orgId}/audit`, but the pinned commercial SDK's `pam()` client
 * exposes only `access_requests()`, `access_rules()`, `leases()`, and the approver surface; there is
 * no audit client, so there is no SDK call to make. Binding this behind an abstraction means the
 * eventual swap is a provider change in `provide-pam.ts` and nothing else.
 *
 * Closing this exception is SDK work: an `audit` module on the `bitwarden-pam` crate. See the
 * follow-up note in this directory's README.
 */
export abstract class AuditApiService {
  /**
   * `GET /organizations/{orgId}/audit` — one page of the organization's access-audit trail, newest
   * first, narrowed by `filter`, with each action's before/after pair already collapsed to one entry
   * by the server.
   *
   * The read is bounded: the server returns a page and a token to resume from, rather than the whole
   * retention window in one response. Filtering happens server-side too, so a narrowed request comes
   * back narrowed rather than being sifted here — which is what makes a filtered result complete
   * instead of complete-within-the-page.
   *
   * Org-scoped and authorized by the AccessEventLogs permission, so this returns the whole
   * organization's trail regardless of which collections the caller manages. A caller without that
   * permission gets a 404 rather than an empty list.
   */
  abstract listAccessAuditTrail(
    organizationId: string,
    filter?: AuditTrailFilter,
  ): Promise<AuditTrailPage>;

  /**
   * `GET /organizations/{orgId}/audit/items` — the distinct subjects the trail names in the given range,
   * one entry per subject, which is what the Item filter's menu is built from.
   *
   * It has to come from the server because neither obvious source works: a page of the trail names only
   * some of the items in range, and this client's own vault holds credentials the trail never mentions.
   * Reading the subjects and keeping the ones this vault can name is what leaves a menu offering exactly
   * the items that both occur and can be labelled.
   *
   * Unpaged: one row per subject is bounded by how many credentials and rules the organization governs,
   * not by how much activity there has been. Same authorization as the trail itself.
   */
  abstract listAccessAuditItems(
    organizationId: string,
    range?: { start?: Date; end?: Date },
  ): Promise<AccessAuditItemResponse[]>;
}
