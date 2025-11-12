import { MockProxy, mock } from "jest-mock-extended";

import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";
import {
  DefaultTaskSchedulerService,
  TaskSchedulerService,
} from "@bitwarden/common/platform/scheduling";
import { FakeGlobalStateProvider } from "@bitwarden/common/spec";
import { LogService } from "@bitwarden/logging";

import { PhishingDataService, PhishingData, PHISHING_DOMAINS_KEY } from "./phishing-data.service";

describe("PhishingDataService", () => {
  let service: PhishingDataService;
  let apiService: MockProxy<ApiService>;
  let taskSchedulerService: TaskSchedulerService;
  let logService: MockProxy<LogService>;
  let platformUtilsService: MockProxy<PlatformUtilsService>;
  const stateProvider: FakeGlobalStateProvider = new FakeGlobalStateProvider();

  const setMockState = (state: PhishingData) => {
    stateProvider.getFake(PHISHING_DOMAINS_KEY).stateSubject.next(state);
    return state;
  };

  let fetchChecksumSpy: jest.SpyInstance;
  let fetchDomainsSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.useFakeTimers();
    apiService = mock<ApiService>();
    logService = mock<LogService>();

    platformUtilsService = mock<PlatformUtilsService>();
    platformUtilsService.getApplicationVersion.mockResolvedValue("1.0.0");

    taskSchedulerService = new DefaultTaskSchedulerService(logService);

    service = new PhishingDataService(
      apiService,
      taskSchedulerService,
      stateProvider,
      logService,
      platformUtilsService,
    );

    fetchChecksumSpy = jest.spyOn(service as any, "fetchPhishingDomainsChecksum");
    fetchDomainsSpy = jest.spyOn(service as any, "fetchPhishingDomains");
  });

  describe("isPhishingDomains", () => {
    it("should detect a phishing domain", async () => {
      setMockState({
        domains: ["phish.com", "badguy.net"],
        timestamp: Date.now(),
        checksum: "abc123",
        applicationVersion: "1.0.0",
      });
      const url = new URL("http://phish.com");
      const result = await service.isPhishingDomain(url);
      expect(result).toBe(true);
    });

    it("should not detect a safe domain", async () => {
      setMockState({
        domains: ["phish.com", "badguy.net"],
        timestamp: Date.now(),
        checksum: "abc123",
        applicationVersion: "1.0.0",
      });
      const url = new URL("http://safe.com");
      const result = await service.isPhishingDomain(url);
      expect(result).toBe(false);
    });

    it("should match against root domain", async () => {
      setMockState({
        domains: ["phish.com", "badguy.net"],
        timestamp: Date.now(),
        checksum: "abc123",
        applicationVersion: "1.0.0",
      });
      const url = new URL("http://phish.com/about");
      const result = await service.isPhishingDomain(url);
      expect(result).toBe(true);
    });

    it("should not error on empty state", async () => {
      setMockState(undefined as any);
      const url = new URL("http://phish.com/about");
      const result = await service.isPhishingDomain(url);
      expect(result).toBe(false);
    });
  });

  describe("getNextDomains", () => {
    it("refetches all domains if applicationVersion has changed", async () => {
      const prev: PhishingData = {
        domains: ["a.com"],
        timestamp: Date.now() - 60000,
        checksum: "old",
        applicationVersion: "1.0.0",
      };
      fetchChecksumSpy.mockResolvedValue("new");
      fetchDomainsSpy.mockResolvedValue(["d.com", "e.com"]);
      platformUtilsService.getApplicationVersion.mockResolvedValue("2.0.0");

      const result = await service.getNextDomains(prev);

      expect(result!.domains).toEqual(["d.com", "e.com"]);
      expect(result!.checksum).toBe("new");
      expect(result!.applicationVersion).toBe("2.0.0");
    });

    it("only updates timestamp if checksum matches", async () => {
      const prev: PhishingData = {
        domains: ["a.com"],
        timestamp: Date.now() - 60000,
        checksum: "abc",
        applicationVersion: "1.0.0",
      };
      fetchChecksumSpy.mockResolvedValue("abc");
      const result = await service.getNextDomains(prev);
      expect(result!.domains).toEqual(prev.domains);
      expect(result!.checksum).toBe("abc");
      expect(result!.timestamp).not.toBe(prev.timestamp);
    });

    it("patches daily domains if cache is fresh", async () => {
      const prev: PhishingData = {
        domains: ["a.com"],
        timestamp: Date.now() - 60000,
        checksum: "old",
        applicationVersion: "1.0.0",
      };
      fetchChecksumSpy.mockResolvedValue("new");
      fetchDomainsSpy.mockResolvedValue(["b.com", "c.com"]);
      const result = await service.getNextDomains(prev);
      expect(result!.domains).toEqual(["a.com", "b.com", "c.com"]);
      expect(result!.checksum).toBe("new");
    });

    it("fetches all domains if cache is old", async () => {
      const prev: PhishingData = {
        domains: ["a.com"],
        timestamp: Date.now() - 2 * 24 * 60 * 60 * 1000,
        checksum: "old",
        applicationVersion: "1.0.0",
      };
      fetchChecksumSpy.mockResolvedValue("new");
      fetchDomainsSpy.mockResolvedValue(["d.com", "e.com"]);
      const result = await service.getNextDomains(prev);
      expect(result!.domains).toEqual(["d.com", "e.com"]);
      expect(result!.checksum).toBe("new");
    });
  });
});
