import { fakeAsync, TestBed, tick } from "@angular/core/testing";

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

    postMessage.mockClear();

    service = TestBed.inject(WebBrowserInteractionService);
  });

  describe("extensionInstalled$", () => {
    it("posts a message to check for the extension", () => {
      service.extensionInstalled$.subscribe();

      expect(postMessage).toHaveBeenCalledWith({
        command: VaultMessages.checkBwInstalled,
      });
    });

    it("returns false after the timeout", fakeAsync(() => {
      service.extensionInstalled$.subscribe((installed) => {
        expect(installed).toBe(false);
      });

      tick(1500);
    }));

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
    it("posts a message to open the extension", fakeAsync(() => {
      service.openExtension().catch(() => {});

      expect(postMessage).toHaveBeenCalledWith({
        command: VaultMessages.OpenBrowserExtensionToUrl,
      });

      tick(1500);
    }));

    it("posts a message with the passed page", fakeAsync(() => {
      service.openExtension(ExtensionPageUrls.Index).catch(() => {});

      expect(postMessage).toHaveBeenCalledWith({
        command: VaultMessages.OpenBrowserExtensionToUrl,
        url: ExtensionPageUrls.Index,
      });

      tick(1500);
    }));

    it("resolves when the extension opens", async () => {
      const openExtensionPromise = service.openExtension().catch(() => {
        fail();
      });

      window.dispatchEvent(
        new MessageEvent("message", { data: { command: VaultMessages.PopupOpened } }),
      );

      await openExtensionPromise;
    });

    it("rejects if the extension does not open within the timeout", fakeAsync(() => {
      service.openExtension().catch((error) => {
        expect(error).toBe("Failed to open the extension");
      });

      tick(1500);
    }));
  });
});
