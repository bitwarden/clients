import { mock } from "jest-mock-extended";

import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";

import { DesktopNavigationCapability } from "./desktop-navigation";

describe("DesktopNavigationCapability", () => {
  it("opens settings through the messaging service", () => {
    const messagingService = mock<MessagingService>();

    new DesktopNavigationCapability(messagingService).openSettings();

    expect(messagingService.send).toHaveBeenCalledWith("openSettings");
  });
});
