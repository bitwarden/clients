// Mock the SDK before importing anything else
jest.mock("@bitwarden/sdk-internal", () => ({
  FlightRecorderClient: jest.fn().mockImplementation(() => ({
    drain: jest.fn().mockReturnValue([]),
    count: jest.fn().mockReturnValue(0),
  })),
}));

import * as lib from "./index";

describe("flight-recorder", () => {
  it("should export FlightRecorderService", () => {
    expect(lib.FlightRecorderService).toBeDefined();
  });

  it("should export FlightRecorderLogData type", () => {
    // FlightRecorderLogData is a type/interface, so we just verify the module loads
    expect(lib).toBeDefined();
  });
});
