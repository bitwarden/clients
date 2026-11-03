import {
  formatRotationAge,
  formatRotationDate,
  formatRotationTimestamp,
} from "./rotation-timestamp";

describe("rotation timestamps", () => {
  const local = (h: number, m: number) => new Date(2026, 8, 19, h, m).toISOString();

  it("drops the minutes on the hour", () => {
    expect(formatRotationTimestamp(local(19, 0))).toBe("Sep 19, 2026, 7 PM");
  });

  it("keeps the minutes off the hour", () => {
    expect(formatRotationTimestamp(local(13, 12))).toBe("Sep 19, 2026, 1:12 PM");
  });

  it("formats the date alone", () => {
    expect(formatRotationDate(local(13, 12))).toBe("Sep 19, 2026");
  });

  it("states how long ago in whole days", () => {
    const now = Date.parse("2026-10-04T12:00:00Z");
    expect(formatRotationAge("2026-10-01T12:00:00Z", now)).toBe("3 days ago");
  });
});
