import { TestBed } from "@angular/core/testing";

import { FlightRecorder } from "@bitwarden/logging";

import { FlightRecorderService } from "./index";

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
