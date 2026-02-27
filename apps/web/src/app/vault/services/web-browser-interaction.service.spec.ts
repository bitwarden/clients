import { fakeAsync, TestBed, tick } from "@angular/core/testing";

import { ExtensionPageUrls } from "@bitwarden/common/vault/enums";
import { VaultMessages } from "@bitwarden/common/vault/enums/vault-messages.enum";

import { WebBrowserInteractionService } from "./web-browser-interaction.service";

describe("WebBrowserInteractionService", () => {
  let service: WebBrowserInteractionService;
  const postMessage = jest.fn();
  window.postMessage = postMessage;

  const dispatchEvent = (command: string) => {
    window.dispatchEvent(new MessageEvent("message", { data: { command } }));
  };

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

      tick(150);
    }));

    it("returns true when the extension is installed", (done) => {
      service.extensionInstalled$.subscribe((installed) => {
        expect(installed).toBe(true);
        done();
      });

      dispatchEvent(VaultMessages.HasBwInstalled);
    });

    it("continues to listen for extension state changes after the first response", fakeAsync(() => {
      const results: boolean[] = [];

      service.extensionInstalled$.subscribe((installed) => {
        results.push(installed);
      });

      // initial timeout, should emit false
      tick(26);
      expect(results[0]).toBe(false);

      tick(2500);
      // then emit `HasBwInstalled`
      dispatchEvent(VaultMessages.HasBwInstalled);
      tick(26);
      expect(results[1]).toBe(true);
    }));
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

      dispatchEvent(VaultMessages.PopupOpened);

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
