import { TestBed } from "@angular/core/testing";

import { DefaultPerformanceTrackingService } from "@bitwarden/performance-tracking";

import { PerformanceTrackingAngularService } from "./index";

describe("PerformanceTrackingAngularService", () => {
  beforeEach(() => {
    TestBed.configureTestingModule({});
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
});
