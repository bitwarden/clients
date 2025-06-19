import { TestBed } from "@angular/core/testing";

import { ExtensionPageUrls } from "@bitwarden/common/vault/enums";
import { VaultMessages } from "@bitwarden/common/vault/enums/vault-messages.enum";

import { WebBrowserInteractionService } from "./web-browser-interaction.service";

describe("WebBrowserInteractionService", () => {
  let service: WebBrowserInteractionService;
  const postMessage = jest.fn();
  window.postMessage = postMessage;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [WebBrowserInteractionService],
    });

    jest.useFakeTimers();
    postMessage.mockClear();

    service = TestBed.inject(WebBrowserInteractionService);
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  describe("extensionInstalled$", () => {
    it("posts a message to check for the extension", () => {
      service.extensionInstalled$.subscribe();

      expect(postMessage).toHaveBeenCalledWith({
        command: VaultMessages.checkBwInstalled,
      });
    });

    it("returns false after the timeout", (done) => {
      service.extensionInstalled$.subscribe((installed) => {
        expect(installed).toBe(false);
        done();
      });

      jest.advanceTimersByTime(1000);
    });

    it("returns true when the extension is installed", (done) => {
      service.extensionInstalled$.subscribe((installed) => {
        expect(installed).toBe(true);
        done();
      });

      window.dispatchEvent(
        new MessageEvent("message", { data: { command: VaultMessages.HasBwInstalled } }),
      );
    });

    it("only calls postMessage once when an extension state is determined", (done) => {
      service.extensionInstalled$.subscribe();

      window.dispatchEvent(
        new MessageEvent("message", { data: { command: VaultMessages.HasBwInstalled } }),
      );

      service.extensionInstalled$.subscribe(() => {
        expect(postMessage).toHaveBeenCalledTimes(1);
        done();
      });
    });
  });

  describe("openExtension", () => {
    it("posts a message to open the extension", async () => {
      service.openExtension().catch(() => {});

      expect(postMessage).toHaveBeenCalledWith({
        command: VaultMessages.OpenBrowserExtensionToPage,
      });

      jest.advanceTimersByTime(1000);
    });

    it("posts a message with the passed page", async () => {
      service.openExtension(ExtensionPageUrls.Default).catch(() => {});

      expect(postMessage).toHaveBeenCalledWith({
        command: VaultMessages.OpenBrowserExtensionToPage,
        page: ExtensionPageUrls.Default,
      });

      jest.advanceTimersByTime(1000);
    });

    it("resolves when the extension opens", async () => {
      const openExtensionPromise = service.openExtension().catch(() => {
        fail();
      });

      window.dispatchEvent(
        new MessageEvent("message", { data: { command: VaultMessages.PopupOpened } }),
      );

      await openExtensionPromise;
    });

    it("rejects if the extension does not open within the timeout", (done) => {
      service.openExtension().catch((error) => {
        expect(error).toBe("Extension failed to open");
        done();
      });

      jest.advanceTimersByTime(1000);
    });
  });
});
