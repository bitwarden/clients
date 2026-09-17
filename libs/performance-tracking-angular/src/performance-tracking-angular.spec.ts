import { TestBed } from "@angular/core/testing";
import { mock } from "jest-mock-extended";

import { LogService } from "@bitwarden/logging";
import { DefaultPerformanceTrackingService } from "@bitwarden/performance-tracking";

import { PerformanceTrackingAngularService } from "./index";

describe("PerformanceTrackingAngularService", () => {
  let logService: jest.Mocked<LogService>;

  beforeEach(() => {
    logService = mock<LogService>();
    TestBed.configureTestingModule({
      providers: [{ provide: LogService, useValue: logService }],
    });
  });

  it("is injectable via Angular DI", () => {
    expect(TestBed.inject(PerformanceTrackingAngularService)).toBeInstanceOf(
      PerformanceTrackingAngularService,
    );
  });

  it("is a singleton at the root injector", () => {
    expect(TestBed.inject(PerformanceTrackingAngularService)).toBe(
      TestBed.inject(PerformanceTrackingAngularService),
    );
  });

  it("inherits from DefaultPerformanceTrackingService", () => {
    expect(TestBed.inject(PerformanceTrackingAngularService)).toBeInstanceOf(
      DefaultPerformanceTrackingService,
    );
  });

  it("routes performance data to the log service's debug channel", () => {
    // jsdom's `performance` has no `mark`.
    performance.mark = jest.fn().mockReturnValue({ name: "a mark" } as PerformanceMark);

    TestBed.inject(PerformanceTrackingAngularService).mark("a mark");

    expect(logService.debug).toHaveBeenCalledWith("a mark", expect.any(String));
  });
});
