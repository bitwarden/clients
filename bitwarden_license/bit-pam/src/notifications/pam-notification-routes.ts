import type { PamNotificationEvent, PamNotificationEventKind } from "./pam-notification-diff";

export type PamNotificationGroup = {
  kind: PamNotificationEventKind;
  ids: string[];
};

/** The order a batch is announced in, most pressing first. */
const KIND_ORDER: PamNotificationEventKind[] = [
  "approvalRequested",
  "requestApproved",
  "requestDenied",
  "requestCanceled",
  "leaseEndingSoon",
  "leaseEnded",
];

/** Batches events of one kind, so a burst reads as a count rather than one alert each. */
export function groupPamNotificationEvents(events: PamNotificationEvent[]): PamNotificationGroup[] {
  return KIND_ORDER.map((kind) => ({
    kind,
    ids: events.filter((event) => event.kind === kind).map((event) => event.id),
  })).filter((group) => group.ids.length > 0);
}

/**
 * Where clicking an alert lands: the request itself when one event names one, otherwise the list
 * that holds them. Always one of the routes the desktop app's notification allowlist admits.
 */
export function pamNotificationRoute(group: PamNotificationGroup): string {
  switch (group.kind) {
    case "approvalRequested":
      return "/pam/approvals";
    case "requestApproved":
    case "requestDenied":
    case "requestCanceled":
      return group.ids.length === 1 ? `/pam/requests/${group.ids[0]}` : "/pam/my-requests";
    case "leaseEndingSoon":
    case "leaseEnded":
      return "/pam/my-requests";
  }
}
