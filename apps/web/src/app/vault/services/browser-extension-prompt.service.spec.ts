import { TestBed } from "@angular/core/testing";

import { AnonLayoutWrapperDataService } from "@bitwarden/auth/angular";
import { VaultOnboardingMessages } from "@bitwarden/common/vault/enums/vault-onboarding.enum";

import {
  BrowserExtensionPromptService,
  BrowserPromptState,
} from "./browser-extension-prompt.service";

describe("BrowserExtensionPromptService", () => {
  let service: BrowserExtensionPromptService;
  const setAnonLayoutWrapperData = jest.fn();
  const postMessage = jest.fn();
  window.postMessage = postMessage;

  beforeEach(() => {
    setAnonLayoutWrapperData.mockClear();
    postMessage.mockClear();

    TestBed.configureTestingModule({
      providers: [
        BrowserExtensionPromptService,
        { provide: AnonLayoutWrapperDataService, useValue: { setAnonLayoutWrapperData } },
      ],
    });
    jest.useFakeTimers();
    service = TestBed.inject(BrowserExtensionPromptService);
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it("defaults page state to loading", (done) => {
    service.pageState$.subscribe((state) => {
      expect(state).toBe(BrowserPromptState.Loading);
      done();
    });
  });

  describe("start", () => {
    it("posts message to check for extension", () => {
      service.start();

      expect(window.postMessage).toHaveBeenCalledWith({
        command: VaultOnboardingMessages.checkBwInstalled,
      });
    });

    it("sets timeout for error state", () => {
      service.start();

      expect(service["extensionCheckTimeout"]).not.toBeNull();
    });

    it("clears timeout on HasBwInstalled event", () => {
      jest.spyOn(window, "clearTimeout");

      service.start();
      window.dispatchEvent(
        new MessageEvent("message", { data: { command: VaultOnboardingMessages.HasBwInstalled } }),
      );

      expect(window.clearTimeout).toHaveBeenCalledTimes(1);
      expect(service["extensionCheckTimeout"]).toBeUndefined();
    });
  });

  describe("error state", () => {
    beforeEach(() => {
      service.start();
    });

    it("sets error state after timeout", () => {
      jest.advanceTimersByTime(1000);
      expect(setAnonLayoutWrapperData).toHaveBeenCalledWith({
        pageTitle: { key: "somethingWentWrong" },
      });
    });
  });
});
