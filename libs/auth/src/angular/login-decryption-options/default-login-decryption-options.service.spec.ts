import { MockProxy, mock } from "jest-mock-extended";

import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";

import { DefaultLoginDecryptionOptionsService } from "./default-login-decryption-options.service";

describe("DefaultLoginDecryptionOptionsService", () => {
  let service: DefaultLoginDecryptionOptionsService;

  let messagingService: MockProxy<MessagingService>;

  beforeEach(() => {
    messagingService = mock<MessagingService>();

    service = new DefaultLoginDecryptionOptionsService(messagingService);
  });

  it("should instantiate the service", () => {
    expect(service).not.toBeFalsy();
  });

  describe("handleCreateUserSuccess()", () => {
    it("should return null", async () => {
      const result = await service.handleCreateUserSuccess();

      expect(result).toBeNull();
    });
  });

  describe("logOut()", () => {
    it("should send a logout message", async () => {
      await service.logOut();

      expect(messagingService.send).toHaveBeenCalledWith("logout");
    });
  });
});
