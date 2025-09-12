import { of } from "rxjs";

import { AuditService } from "@bitwarden/common/abstractions/audit.service";
import { EventCollectionService } from "@bitwarden/common/abstractions/event/event-collection.service";
import { ConfigService } from "@bitwarden/common/platform/abstractions/config/config.service";
import { LogService } from "@bitwarden/common/platform/abstractions/log.service";
import { AbstractStorageService } from "@bitwarden/common/platform/abstractions/storage.service";
import { TaskSchedulerService } from "@bitwarden/common/platform/scheduling/task-scheduler.service";

import { PhishingDetectionService } from "./phishing-detection.service";


describe("PhishingDetectionService", () => {
  let auditService: AuditService;
  let logService: LogService;
  let storageService: AbstractStorageService;
  let taskSchedulerService: TaskSchedulerService;
  let configService: ConfigService;
  let eventCollectionService: EventCollectionService;

  beforeEach(() => {
    auditService = { getKnownPhishingDomains: jest.fn() } as any;
    logService = { info: jest.fn(), debug: jest.fn(), warning: jest.fn(), error: jest.fn() } as any;
    storageService = { get: jest.fn(), save: jest.fn() } as any;
    taskSchedulerService = { registerTaskHandler: jest.fn(), setInterval: jest.fn() } as any;
    configService = { getFeatureFlag$: jest.fn(() => of(false)) } as any;
    eventCollectionService = {} as any;
  });

  it("should initialize without errors", () => {
    expect(() => {
      PhishingDetectionService.initialize(
        configService,
        auditService,
        logService,
        storageService,
        taskSchedulerService,
        eventCollectionService,
      );
    }).not.toThrow();
  });

  it("should detect phishing domains", () => {
    PhishingDetectionService["_knownPhishingDomains"].add("phishing.com");
    const url = new URL("https://phishing.com");
    expect(PhishingDetectionService.isPhishingDomain(url)).toBe(true);
    const safeUrl = new URL("https://safe.com");
    expect(PhishingDetectionService.isPhishingDomain(safeUrl)).toBe(false);
  });

  // Add more tests for other methods as needed
});
