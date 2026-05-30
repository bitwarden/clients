import { elapsedKey } from "./approver-inbox-row.component";

describe("elapsedKey", () => {
  const now = new Date("2026-05-15T12:00:00Z");

  it("returns 'just now' for very recent timestamps", () => {
    expect(elapsedKey("2026-05-15T11:59:50Z", now)).toEqual({
      key: "pamInboxElapsedJustNow",
      value: 0,
    });
  });

  it("returns minutes for sub-hour gaps", () => {
    expect(elapsedKey("2026-05-15T11:45:00Z", now)).toEqual({
      key: "pamInboxElapsedMinutes",
      value: 15,
    });
  });

  it("returns hours for sub-day gaps", () => {
    expect(elapsedKey("2026-05-15T08:00:00Z", now)).toEqual({
      key: "pamInboxElapsedHours",
      value: 4,
    });
  });

  it("returns days for multi-day gaps", () => {
    expect(elapsedKey("2026-05-12T12:00:00Z", now)).toEqual({
      key: "pamInboxElapsedDays",
      value: 3,
    });
  });

  it("falls back to 'just now' for unparseable timestamps", () => {
    expect(elapsedKey("not-a-date", now)).toEqual({
      key: "pamInboxElapsedJustNow",
      value: 0,
    });
  });

  it("clamps negative deltas to 'just now'", () => {
    expect(elapsedKey("2026-05-15T13:00:00Z", now)).toEqual({
      key: "pamInboxElapsedJustNow",
      value: 0,
    });
  });
});
