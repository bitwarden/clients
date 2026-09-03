import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";

import { AutomationCapability } from "../automation-capability";

/** Navigates the desktop client through its menubar message handlers. Desktop only. */
export class DesktopNavigationCapability extends AutomationCapability {
  readonly automationName = "desktopNavigation";

  constructor(private messagingService: MessagingService) {
    super();
  }

  /** Opens the settings page. */
  openSettings(): void {
    this.messagingService.send("openSettings");
  }
}
