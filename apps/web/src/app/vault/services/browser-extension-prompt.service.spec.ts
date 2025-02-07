import { TestBed } from "@angular/core/testing";

import { AnonLayoutWrapperDataService } from "@bitwarden/auth/angular";
import { VaultMessages } from "@bitwarden/common/vault/enums/vault-messages.enum";

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
        command: VaultMessages.checkBwInstalled,
      });
    });

    it("sets timeout for error state", () => {
      service.start();

      expect(service["extensionCheckTimeout"]).not.toBeNull();
    });

    it("attempts to open the extension when installed", () => {
      service.start();

      window.dispatchEvent(
        new MessageEvent("message", { data: { command: VaultMessages.HasBwInstalled } }),
      );

      expect(window.postMessage).toHaveBeenCalledTimes(2);
      expect(window.postMessage).toHaveBeenCalledWith({ command: VaultMessages.OpenPopup });
    });
  });

  describe("success state", () => {
    beforeEach(() => {
      service.start();

      window.dispatchEvent(
        new MessageEvent("message", { data: { command: VaultMessages.PopupOpened } }),
      );
    });

    it("sets layout title", () => {
      expect(setAnonLayoutWrapperData).toHaveBeenCalledWith({
        pageTitle: { key: "openedExtension" },
      });
    });

    it("sets success page state", (done) => {
      service.pageState$.subscribe((state) => {
        expect(state).toBe(BrowserPromptState.Success);
        done();
      });
    });

    it("clears the error timeout", () => {
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
