import { mock, MockProxy } from "jest-mock-extended";
import { Subject } from "rxjs";

import { LogService } from "@bitwarden/logging";
import { MessageListener } from "@bitwarden/messaging";
import { AcquiredCookie } from "@bitwarden/sdk-internal";

import { PlatformUtilsService } from "../../abstractions/platform-utils.service";

import { ServerCommunicationConfigPlatformApiService } from "./server-communication-config-platform-api.service";

describe("ServerCommunicationConfigPlatformApiService", () => {
  let platformUtilsService: MockProxy<PlatformUtilsService>;
  let messageListener: MockProxy<MessageListener>;
  let logService: MockProxy<LogService>;
  let service: ServerCommunicationConfigPlatformApiService;
  let callbackSubject: Subject<{ urlString: string }>;

  beforeEach(() => {
    platformUtilsService = mock<PlatformUtilsService>();
    messageListener = mock<MessageListener>();
    logService = mock<LogService>();

    // Create a Subject to simulate message stream
    callbackSubject = new Subject<{ urlString: string }>();
    messageListener.messages$.mockReturnValue(callbackSubject.asObservable());

    service = new ServerCommunicationConfigPlatformApiService(
      platformUtilsService,
      messageListener,
      logService,
    );
  });

  describe("acquireCookies", () => {
    it("opens browser to correct URL", async () => {
      const promise = service.acquireCookies("vault.acme.com");

      expect(platformUtilsService.launchUri).toHaveBeenCalledWith(
        "https://vault.acme.com/proxy-cookie-redirect-connector.html",
      );

      // Simulate callback to resolve promise
      callbackSubject.next({
        urlString: "bitwarden://sso-cookie-vendor?testCookie=value123",
      });

      await promise;
    });

    it("parses single cookie from callback URL", async () => {
      const promise = service.acquireCookies("vault.acme.com");

      // Simulate callback with single cookie
      callbackSubject.next({
        urlString: "bitwarden://sso-cookie-vendor?AWSELBAuthSessionCookie=abc123",
      });

      const result = await promise;

      expect(result).toEqual([{ name: "AWSELBAuthSessionCookie", value: "abc123" }]);
    });

    it("parses sharded cookies from callback URL", async () => {
      const promise = service.acquireCookies("vault.acme.com");

      // Simulate callback with sharded cookies
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

      // Simulate callback with 'd' integrity marker
      callbackSubject.next({
        urlString:
          "bitwarden://sso-cookie-vendor?AWSELBAuthSessionCookie=abc123&d=integrity_marker_value",
      });

      const result = await promise;

      // Should only have the cookie, not the 'd' parameter
      expect(result).toEqual([{ name: "AWSELBAuthSessionCookie", value: "abc123" }]);
      expect(result?.find((c: AcquiredCookie) => c.name === "d")).toBeUndefined();
    });

    it("returns undefined when no cookies in callback", async () => {
      const promise = service.acquireCookies("vault.acme.com");

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

      // Fast-forward time by 5 minutes
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

      // Should only launch browser once
      expect(platformUtilsService.launchUri).toHaveBeenCalledTimes(1);

      // Simulate callback
      callbackSubject.next({
        urlString: "bitwarden://sso-cookie-vendor?cookie=value",
      });

      const [result1, result2] = await Promise.all([promise1, promise2]);

      // Both promises should resolve with same result
      expect(result1).toEqual([{ name: "cookie", value: "value" }]);
      expect(result2).toEqual([{ name: "cookie", value: "value" }]);
    });

    it("cancels previous acquisition when different hostname requested", async () => {
      jest.useFakeTimers();

      // The esline rule below is disabled, as the promise purposefully is not awaited/resolved, to test the behaviour.
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      service.acquireCookies("vault1.acme.com");

      // Request acquisition for different hostname
      const promise2 = service.acquireCookies("vault2.acme.com");

      // Should launch browser twice (once for each hostname)
      expect(platformUtilsService.launchUri).toHaveBeenCalledTimes(2);
      expect(platformUtilsService.launchUri).toHaveBeenCalledWith(
        "https://vault1.acme.com/proxy-cookie-redirect-connector.html",
      );
      expect(platformUtilsService.launchUri).toHaveBeenCalledWith(
        "https://vault2.acme.com/proxy-cookie-redirect-connector.html",
      );

      // Simulate callback for second hostname
      callbackSubject.next({
        urlString: "bitwarden://sso-cookie-vendor?cookie=value2",
      });

      // First promise should still be pending (not resolved)
      // Second promise should resolve
      const result2 = await promise2;
      expect(result2).toEqual([{ name: "cookie", value: "value2" }]);

      expect(logService.warning).toHaveBeenCalledWith(
        "Cancelling previous cookie acquisition for different hostname",
      );

      jest.useRealTimers();
    });

    it("handles invalid callback URL gracefully", async () => {
      const promise = service.acquireCookies("vault.acme.com");

      // Simulate callback with invalid URL
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
      // Simulate callback without any pending acquisition
      callbackSubject.next({
        urlString: "bitwarden://sso-cookie-vendor?cookie=value",
      });

      expect(logService.warning).toHaveBeenCalledWith(
        "Received cookie callback but no acquisition pending",
      );
    });
  });
});
