import { mock, MockProxy } from "jest-mock-extended";
import { Subject } from "rxjs";

import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import { DialogService } from "@bitwarden/components";
import { LogService } from "@bitwarden/logging";
import { MessageListener } from "@bitwarden/messaging";
import { AcquiredCookie } from "@bitwarden/sdk-internal";

import { ServerCommunicationConfigPlatformApiService } from "./server-communication-config-platform-api.service";

describe("ServerCommunicationConfigPlatformApiService", () => {
  let platformUtilsService: MockProxy<PlatformUtilsService>;
  let messageListener: MockProxy<MessageListener>;
  let logService: MockProxy<LogService>;
  let dialogService: MockProxy<DialogService>;
  let service: ServerCommunicationConfigPlatformApiService;
  let callbackSubject: Subject<{ urlString: string }>;

  // Flush all pending microtasks so the dialog mock can resolve before the callback is sent
  const flushDialog = () => Promise.resolve();

  beforeEach(() => {
    platformUtilsService = mock<PlatformUtilsService>();
    messageListener = mock<MessageListener>();
    logService = mock<LogService>();
    dialogService = mock<DialogService>();

    // Default: user approves the dialog
    dialogService.openSimpleDialog.mockResolvedValue(true);

    callbackSubject = new Subject<{ urlString: string }>();
    messageListener.messages$.mockReturnValue(callbackSubject.asObservable());

    service = new ServerCommunicationConfigPlatformApiService(
      platformUtilsService,
      messageListener,
      logService,
      dialogService,
    );
    service.init();
  });

  describe("acquireCookies", () => {
    it("shows dialog with correct parameters and launches browser on approval", async () => {
      const promise = service.acquireCookies("vault.acme.com");

      expect(dialogService.openSimpleDialog).toHaveBeenCalledWith({
        title: { key: "syncWithBrowser" },
        content: {
          key: "acquireCookieSpeedbumpContent",
          placeholders: ["https://vault.acme.com"],
        },
        acceptButtonText: { key: "launchBrowser" },
        cancelButtonText: { key: "later" },
        type: "warning",
      });

      await flushDialog();

      expect(platformUtilsService.launchUri).toHaveBeenCalledWith(
        "https://vault.acme.com/proxy-cookie-redirect-connector.html",
      );

      // Resolve the promise via callback
      callbackSubject.next({ urlString: "bitwarden://sso-cookie-vendor?testCookie=value123" });
      await promise;
    });

    it("returns undefined and does not launch browser when user cancels dialog", async () => {
      dialogService.openSimpleDialog.mockResolvedValue(false);

      const result = await service.acquireCookies("vault.acme.com");

      expect(result).toBeUndefined();
      expect(platformUtilsService.launchUri).not.toHaveBeenCalled();
    });

    it("normalizes vault URL without https:// prefix", async () => {
      const promise = service.acquireCookies("vault.acme.com");

      await flushDialog();

      expect(platformUtilsService.launchUri).toHaveBeenCalledWith(
        "https://vault.acme.com/proxy-cookie-redirect-connector.html",
      );

      callbackSubject.next({ urlString: "bitwarden://sso-cookie-vendor?cookie=val" });
      await promise;
    });

    it("parses single cookie from callback URL", async () => {
      const promise = service.acquireCookies("vault.acme.com");

      await flushDialog();

      callbackSubject.next({
        urlString: "bitwarden://sso-cookie-vendor?AWSELBAuthSessionCookie=abc123",
      });

      const result = await promise;

      expect(result).toEqual([{ name: "AWSELBAuthSessionCookie", value: "abc123" }]);
    });

    it("parses sharded cookies from callback URL", async () => {
      const promise = service.acquireCookies("vault.acme.com");

      await flushDialog();

      callbackSubject.next({
        urlString:
          "bitwarden://sso-cookie-vendor?AWSELBAuthSessionCookie-0=part1&AWSELBAuthSessionCookie-1=part2&AWSELBAuthSessionCookie-2=part3",
      });

      const result = await promise;

      expect(result).toEqual([
        { name: "AWSELBAuthSessionCookie-0", value: "part1" },
        { name: "AWSELBAuthSessionCookie-1", value: "part2" },
        { name: "AWSELBAuthSessionCookie-2", value: "part3" },
      ]);
    });

    it("excludes 'd' parameter from cookies", async () => {
      const promise = service.acquireCookies("vault.acme.com");

      await flushDialog();

      callbackSubject.next({
        urlString:
          "bitwarden://sso-cookie-vendor?AWSELBAuthSessionCookie=abc123&d=integrity_marker_value",
      });

      const result = await promise;

      expect(result).toEqual([{ name: "AWSELBAuthSessionCookie", value: "abc123" }]);
      expect(result?.find((c: AcquiredCookie) => c.name === "d")).toBeUndefined();
    });

    it("returns undefined when no cookies in callback", async () => {
      const promise = service.acquireCookies("vault.acme.com");

      await flushDialog();

      // Simulate callback with only 'd' parameter (which is excluded)
      callbackSubject.next({
        urlString: "bitwarden://sso-cookie-vendor?d=integrity",
      });

      const result = await promise;

      expect(result).toBeUndefined();
    });

    it("returns undefined on timeout after 5 minutes", async () => {
      jest.useFakeTimers();

      const promise = service.acquireCookies("vault.acme.com");

      // Flush dialog before advancing timers — timeout only starts after approval
      await flushDialog();

      jest.advanceTimersByTime(5 * 60 * 1000);

      const result = await promise;

      expect(result).toBeUndefined();
      expect(logService.warning).toHaveBeenCalledWith(
        "Cookie acquisition timeout for vault.acme.com",
      );

      jest.useRealTimers();
    });

    it("deduplicates concurrent calls for same hostname", async () => {
      const promise1 = service.acquireCookies("vault.acme.com");
      const promise2 = service.acquireCookies("vault.acme.com");

      // Dialog should only be shown once; promise2 reuses the in-flight promise
      expect(dialogService.openSimpleDialog).toHaveBeenCalledTimes(1);

      await flushDialog();

      callbackSubject.next({
        urlString: "bitwarden://sso-cookie-vendor?cookie=value",
      });

      const [result1, result2] = await Promise.all([promise1, promise2]);

      expect(result1).toEqual([{ name: "cookie", value: "value" }]);
      expect(result2).toEqual([{ name: "cookie", value: "value" }]);
    });

    it("cancels previous acquisition when different hostname requested", async () => {
      // Vault1's dialog is controlled manually so it stays open during the test
      let resolveVault1Dialog: (value: boolean) => void;
      const vault1DialogPromise = new Promise<boolean>((resolve) => {
        resolveVault1Dialog = resolve;
      });
      dialogService.openSimpleDialog
        .mockReturnValueOnce(vault1DialogPromise) // vault1: dialog stays open
        .mockResolvedValue(true); // vault2: dialog approves immediately

      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      service.acquireCookies("vault1.acme.com");

      const promise2 = service.acquireCookies("vault2.acme.com");

      expect(logService.warning).toHaveBeenCalledWith(
        "Cancelling previous cookie acquisition for different hostname",
      );

      // Dialog was requested for both hostnames
      expect(dialogService.openSimpleDialog).toHaveBeenCalledTimes(2);

      // Flush vault2's dialog — vault1's is still pending
      await flushDialog();

      // Browser only launched for vault2 (vault1 never got past its dialog)
      expect(platformUtilsService.launchUri).toHaveBeenCalledTimes(1);
      expect(platformUtilsService.launchUri).toHaveBeenCalledWith(
        "https://vault2.acme.com/proxy-cookie-redirect-connector.html",
      );

      callbackSubject.next({
        urlString: "bitwarden://sso-cookie-vendor?cookie=value2",
      });

      const result2 = await promise2;
      expect(result2).toEqual([{ name: "cookie", value: "value2" }]);

      // Silence the unused variable warning from the deferred promise setup
      resolveVault1Dialog!(false);
    });

    it("handles invalid callback URL gracefully", async () => {
      const promise = service.acquireCookies("vault.acme.com");

      await flushDialog();

      callbackSubject.next({
        urlString: "not-a-valid-url",
      });

      const result = await promise;

      expect(result).toBeUndefined();
      expect(logService.error).toHaveBeenCalledWith(
        "Failed to parse cookie callback URL",
        expect.anything(),
      );
    });

    it("ignores callback when no acquisition pending", () => {
      callbackSubject.next({
        urlString: "bitwarden://sso-cookie-vendor?cookie=value",
      });

      expect(logService.warning).toHaveBeenCalledWith(
        "Received cookie callback but no acquisition pending",
      );
    });
  });
});
