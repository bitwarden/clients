import { EventResponse, EventType } from "@bitwarden/common/dirt/event-logs";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

/** Member info resolved from an org user map, as shown in event-log Member columns. */
export interface ResolvedMember {
  name: string;
  email: string;
  organizationUserId?: string;
}

/**
 * True when a User ID resolves to a confirmed org member whose events can be opened.
 */
export function isLinkableMember(
  userId: string | null | undefined,
  orgUsersUserIdMap: Map<string, ResolvedMember>,
): boolean {
  return userId != null && orgUsersUserIdMap.get(userId)?.organizationUserId != null;
}

/**
 * The set of User IDs in the org map that are confirmed, linkable members.
 */
export function collectLinkableMemberIds(
  orgUsersUserIdMap: Map<string, ResolvedMember>,
): Set<string> {
  const ids = new Set<string>();
  for (const userId of orgUsersUserIdMap.keys()) {
    if (isLinkableMember(userId, orgUsersUserIdMap)) {
      ids.add(userId);
    }
  }
  return ids;
}

/**
 * Resolves the Member column value for a Send access event (`Send_Accessed_Text` /
 * `Send_Accessed_File`).
 *
 * Send access rows show the accessor, never the Send creator: a confirmed org member when the
 * accessor is one, otherwise the claimed email domain, otherwise a generic "External" label. The
 * accessor must be resolved strictly from `actingUserId` — `EventView.userId` coalesces to the
 * creator for external accesses, which would otherwise surface the creator's name instead of
 * "External".
 *
 * Returns `undefined` for any other event type so callers can fall through to their own resolution.
 */
export function resolveSendAccessMember(
  ev: EventResponse,
  orgUsersUserIdMap: Map<string, ResolvedMember>,
  i18nService: I18nService,
): ResolvedMember | undefined {
  if (ev.type !== EventType.Send_Accessed_Text && ev.type !== EventType.Send_Accessed_File) {
    return undefined;
  }
  if (ev.actingUserId != null && orgUsersUserIdMap.has(ev.actingUserId)) {
    return orgUsersUserIdMap.get(ev.actingUserId);
  }
  if (ev.domainName) {
    return { name: i18nService.t("sendAccessExternalDomain", ev.domainName), email: "" };
  }
  return { name: i18nService.t("sendAccessExternal"), email: "" };
}
