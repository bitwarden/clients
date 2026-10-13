import { mock } from "jest-mock-extended";

import { FlightRecorder } from "@bitwarden/logging";

import { LoggingCapability } from "./logging";

describe("LoggingCapability", () => {
  let flightRecorder: ReturnType<typeof mock<FlightRecorder>>;
  let sut: LoggingCapability;

  beforeEach(() => {
    flightRecorder = mock<FlightRecorder>();
    sut = new LoggingCapability(flightRecorder);
  });

  it("reads flight recorder events", async () => {
    flightRecorder.read.mockResolvedValue([]);

    await expect(sut.readEvents()).resolves.toEqual([]);
    expect(flightRecorder.read).toHaveBeenCalled();
  });

  it("counts flight recorder events", async () => {
    flightRecorder.count.mockResolvedValue(2);

    await expect(sut.countEvents()).resolves.toBe(2);
  });
});
