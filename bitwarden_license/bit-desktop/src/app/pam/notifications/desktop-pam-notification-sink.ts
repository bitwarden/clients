import {
  groupPamNotificationEvents,
  PamNotificationEvent,
  PamNotificationEventKind,
  PamNotificationSink,
  pamNotificationRoute,
} from "@bitwarden/bit-pam";
import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

const MESSAGE_KEYS: Record<PamNotificationEventKind, { one: string; many: string }> = {
  approvalRequested: {
    one: "pamNotificationApprovalRequestedOne",
    many: "pamNotificationApprovalRequestedMany",
  },
  requestApproved: {
    one: "pamNotificationRequestApprovedOne",
    many: "pamNotificationRequestApprovedMany",
  },
  requestDenied: {
    one: "pamNotificationRequestDeniedOne",
    many: "pamNotificationRequestDeniedMany",
  },
  requestCanceled: {
    one: "pamNotificationRequestCanceledOne",
    many: "pamNotificationRequestCanceledMany",
  },
  leaseEndingSoon: {
    one: "pamNotificationLeaseEndingSoonOne",
    many: "pamNotificationLeaseEndingSoonMany",
  },
  leaseEnded: {
    one: "pamNotificationLeaseEndedOne",
    many: "pamNotificationLeaseEndedMany",
  },
};

/**
 * One system notification per kind of event, worded by count alone. Never names an item, folder
 * or person, since a notification can show on a lock screen.
 */
export class DesktopPamNotificationSink extends PamNotificationSink {
  constructor(private i18nService: I18nService) {
    super();
  }

  async notify(events: PamNotificationEvent[]): Promise<void> {
    for (const group of groupPamNotificationEvents(events)) {
      const keys = MESSAGE_KEYS[group.kind];
      const body =
        group.ids.length === 1
          ? this.i18nService.t(keys.one)
          : this.i18nService.t(keys.many, String(group.ids.length));
      await ipc.platform.showNotification({
        title: this.i18nService.t("pamAccessRequestsTitle"),
        body,
        route: pamNotificationRoute(group),
      });
    }
  }
}
