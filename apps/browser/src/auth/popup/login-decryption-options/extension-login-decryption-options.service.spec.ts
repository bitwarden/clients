import { Router } from "@angular/router";
import { MockProxy, mock } from "jest-mock-extended";
import { BehaviorSubject } from "rxjs";

import { MessagingService } from "@bitwarden/common/platform/abstractions/messaging.service";

import { postLogoutMessageListener$ } from "../utils/post-logout-message-listener";

import { ExtensionLoginDecryptionOptionsService } from "./extension-login-decryption-options.service";

// Mock the module providing postLogoutMessageListener$
jest.mock("../utils/post-logout-message-listener", () => {
  return {
    postLogoutMessageListener$: new BehaviorSubject<string>(""), // Replace with mock subject
  };
});

describe("ExtensionLoginDecryptionOptionsService", () => {
  let service: ExtensionLoginDecryptionOptionsService;

  let messagingService: MockProxy<MessagingService>;
  let router: MockProxy<Router>;
  let postLogoutMessageSubject: BehaviorSubject<string>;

  beforeEach(() => {
    messagingService = mock<MessagingService>();
    router = mock<Router>();

    // Cast postLogoutMessageListener$ to BehaviorSubject for dynamic control
    postLogoutMessageSubject = postLogoutMessageListener$ as BehaviorSubject<string>;

    service = new ExtensionLoginDecryptionOptionsService(messagingService, router);
  });

  it("should instantiate the service", () => {
    expect(service).not.toBeFalsy();
  });

  describe("logOut()", () => {
    it("should send a logout message", async () => {
      postLogoutMessageSubject.next("switchAccountFinish");

      await service.logOut();

      expect(messagingService.send).toHaveBeenCalledWith("logout");
    });

    it("should navigate to root on 'switchAccountFinish'", async () => {
      postLogoutMessageSubject.next("switchAccountFinish");

      await service.logOut();

      expect(router.navigate).toHaveBeenCalledWith(["/"]);
    });

    it("should not navigate for 'doneLoggingOut'", async () => {
      postLogoutMessageSubject.next("doneLoggingOut");

      await service.logOut();

      expect(router.navigate).not.toHaveBeenCalled();
    });
  });
});
