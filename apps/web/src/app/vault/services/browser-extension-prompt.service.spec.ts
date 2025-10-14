import { TestBed } from "@angular/core/testing";
import { firstValueFrom, Observable } from "rxjs";

import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { VaultMessages } from "@bitwarden/common/vault/enums/vault-messages.enum";
import { AnonLayoutWrapperDataService } from "@bitwarden/components";

import {
  BrowserExtensionPromptService,
  BrowserPromptState,
} from "./browser-extension-prompt.service";
import { WebBrowserInteractionService } from "./web-browser-interaction.service";

describe("BrowserExtensionPromptService", () => {
  let service: BrowserExtensionPromptService;
  const setAnonLayoutWrapperData = jest.fn();
  const isFirefox = jest.fn().mockReturnValue(false);
  const openExtensionMock = jest.fn().mockResolvedValue(undefined);
  const postMessage = jest.fn();
  window.postMessage = postMessage;

  beforeEach(() => {
    setAnonLayoutWrapperData.mockClear();
    postMessage.mockClear();
    isFirefox.mockClear();
    openExtensionMock.mockClear();

    TestBed.configureTestingModule({
      providers: [
        BrowserExtensionPromptService,
        { provide: AnonLayoutWrapperDataService, useValue: { setAnonLayoutWrapperData } },
        { provide: PlatformUtilsService, useValue: { isFirefox } },
        { provide: WebBrowserInteractionService, useValue: { openExtension: openExtensionMock } },
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
      expect(window.postMessage).toHaveBeenCalledWith({
        command: VaultMessages.checkBwInstalled,
      });
      expect(window.postMessage).toHaveBeenCalledWith({
        command: VaultMessages.OpenAtRiskPasswords,
      });
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

  describe("firefox", () => {
    beforeEach(() => {
      isFirefox.mockReturnValue(true);
      service.start();
    });

    afterEach(() => {
      isFirefox.mockReturnValue(false);
    });

    it("sets manual open state", (done) => {
      service.pageState$.subscribe((state) => {
        expect(state).toBe(BrowserPromptState.ManualOpen);
        done();
      });
    });

    it("sets error state after timeout", () => {
      expect(setAnonLayoutWrapperData).toHaveBeenCalledWith({
        pageTitle: { key: "somethingWentWrong" },
      });
    });
  });

  describe("mobile state", () => {
    beforeEach(() => {
      Utils.isMobileBrowser = true;
      service.start();
    });

    afterEach(() => {
      Utils.isMobileBrowser = false;
    });

    it("sets mobile state", (done) => {
      service.pageState$.subscribe((state) => {
        expect(state).toBe(BrowserPromptState.MobileBrowser);
        done();
      });
    });

    it("sets desktop required title", () => {
      expect(setAnonLayoutWrapperData).toHaveBeenCalledWith({
        pageTitle: { key: "desktopRequired" },
      });
    });

    it("clears the error timeout", () => {
      expect(service["extensionCheckTimeout"]).toBeUndefined();
    });
  });

  describe("error state", () => {
    beforeEach(() => {
      service.start();
      jest.advanceTimersByTime(1000);
    });

    it("sets error state", (done) => {
      service.pageState$.subscribe((state) => {
        expect(state).toBe(BrowserPromptState.Error);
        done();
      });
    });

    it("sets error state after timeout", () => {
      expect(setAnonLayoutWrapperData).toHaveBeenCalledWith({
        pageTitle: { key: "somethingWentWrong" },
      });
    });

    it("sets manual open state when open extension is called", async () => {
      const pageState$: Observable<BrowserPromptState> = service.pageState$;

      await service.openExtension(VaultMessages.OpenAtRiskPasswords, true);
      jest.advanceTimersByTime(1000);

      expect(await firstValueFrom(pageState$)).toBe(BrowserPromptState.ManualOpen);
    });

    it("shows success state when extension auto opens", async () => {
      await service.openExtension(VaultMessages.OpenAtRiskPasswords, true);

      jest.advanceTimersByTime(500); // don't let timeout occur

      window.dispatchEvent(
        new MessageEvent("message", { data: { command: VaultMessages.PopupOpened } }),
      );

      const pageState$: Observable<BrowserPromptState> = service.pageState$;
      expect(await firstValueFrom(pageState$)).toBe(BrowserPromptState.Success);
      expect(service["extensionCheckTimeout"]).toBeUndefined();
    });
  });
});
