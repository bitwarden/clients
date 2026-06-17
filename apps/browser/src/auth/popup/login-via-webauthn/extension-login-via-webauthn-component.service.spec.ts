import { MockProxy, mock } from "jest-mock-extended";

import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";

import { ExtensionLoginViaWebAuthnComponentService } from "./extension-login-via-webauthn-component.service";

describe("ExtensionLoginViaWebAuthnComponentService", () => {
  let service: ExtensionLoginViaWebAuthnComponentService;
  let messagingService: MockProxy<MessagingService>;
  let windowCloseSpy: jest.SpyInstance;

  beforeEach(() => {
    messagingService = mock<MessagingService>();
    windowCloseSpy = jest.spyOn(window, "close").mockImplementation(() => undefined);
    service = new ExtensionLoginViaWebAuthnComponentService(messagingService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("sets successRoute to /tabs/vault", () => {
    expect(service.successRoute).toBe("/tabs/vault");
  });

  describe("handleSuccessfulAuthentication", () => {
    it("returns false and does not close the popout when shouldAutoClosePopout is false", async () => {
      const result = await service.handleSuccessfulAuthentication(false);

      expect(result).toBe(false);
      expect(messagingService.send).not.toHaveBeenCalled();
      expect(windowCloseSpy).not.toHaveBeenCalled();
    });

    it("sends openPopup, closes the window, and returns true when shouldAutoClosePopout is true", async () => {
      const result = await service.handleSuccessfulAuthentication(true);

      expect(messagingService.send).toHaveBeenCalledWith("openPopup");
      expect(windowCloseSpy).toHaveBeenCalled();
      expect(result).toBe(true);
    });
  });
});
