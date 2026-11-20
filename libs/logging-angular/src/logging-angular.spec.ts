import { TestBed } from "@angular/core/testing";

import { FlightRecorder, FlightRecorderLogRecorder } from "@bitwarden/logging";

import { FlightRecorderLogRecorderService, FlightRecorderService } from "./index";

describe("FlightRecorderService", () => {
  beforeEach(() => {
    TestBed.configureTestingModule({});
  });

  it("is injectable via Angular DI", () => {
    expect(TestBed.inject(FlightRecorderService)).toBeInstanceOf(FlightRecorderService);
  });

  it("is a singleton at the root injector", () => {
    expect(TestBed.inject(FlightRecorderService)).toBe(TestBed.inject(FlightRecorderService));
  });

  it("inherits from FlightRecorder", () => {
    expect(TestBed.inject(FlightRecorderService)).toBeInstanceOf(FlightRecorder);
  });
});

describe("FlightRecorderLogRecorderService", () => {
  beforeEach(() => {
    TestBed.configureTestingModule({});
  });

  it("is injectable via Angular DI", () => {
    expect(TestBed.inject(FlightRecorderLogRecorderService)).toBeInstanceOf(
      FlightRecorderLogRecorderService,
    );
  });

  it("is a singleton at the root injector", () => {
    expect(TestBed.inject(FlightRecorderLogRecorderService)).toBe(
      TestBed.inject(FlightRecorderLogRecorderService),
    );
  });

  it("inherits from FlightRecorderLogRecorder", () => {
    expect(TestBed.inject(FlightRecorderLogRecorderService)).toBeInstanceOf(
      FlightRecorderLogRecorder,
    );
  });
});
