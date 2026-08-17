import { elapsedLabel } from "./elapsed";

const NOW = new Date("2026-08-17T12:00:00.000Z");

/** `NOW` minus the given number of minutes, as an ISO string. */
function minutesAgo(minutes: number): string {
  return new Date(NOW.getTime() - minutes * 60_000).toISOString();
}

describe("elapsedLabel", () => {
  it("reads 'just now' under a minute", () => {
    expect(elapsedLabel(minutesAgo(0), NOW)).toEqual({ key: "pamInboxElapsedJustNow", value: 0 });
    expect(elapsedLabel(minutesAgo(0.9), NOW)).toEqual({ key: "pamInboxElapsedJustNow", value: 0 });
  });

  it("counts whole minutes up to an hour", () => {
    expect(elapsedLabel(minutesAgo(1), NOW)).toEqual({ key: "pamInboxElapsedMinutes", value: 1 });
    expect(elapsedLabel(minutesAgo(59), NOW)).toEqual({ key: "pamInboxElapsedMinutes", value: 59 });
  });

  it("counts whole hours up to a day", () => {
    expect(elapsedLabel(minutesAgo(60), NOW)).toEqual({ key: "pamInboxElapsedHours", value: 1 });
    expect(elapsedLabel(minutesAgo(90), NOW)).toEqual({ key: "pamInboxElapsedHours", value: 1 });
    expect(elapsedLabel(minutesAgo(23 * 60), NOW)).toEqual({
      key: "pamInboxElapsedHours",
      value: 23,
    });
  });

  it("counts whole days beyond that", () => {
    expect(elapsedLabel(minutesAgo(24 * 60), NOW)).toEqual({
      key: "pamInboxElapsedDays",
      value: 1,
    });
    expect(elapsedLabel(minutesAgo(50 * 60), NOW)).toEqual({
      key: "pamInboxElapsedDays",
      value: 2,
    });
  });

  it("rounds down, so nothing ever reads as older than it is", () => {
    expect(elapsedLabel(minutesAgo(119), NOW)).toEqual({ key: "pamInboxElapsedHours", value: 1 });
  });

  it("clamps a future timestamp to 'just now' rather than going negative", () => {
    expect(elapsedLabel(minutesAgo(-30), NOW)).toEqual({
      key: "pamInboxElapsedJustNow",
      value: 0,
    });
  });

  it("reads an unparseable timestamp as 'just now' rather than throwing", () => {
    // A malformed date must not blank out a row the approver still needs to act on.
    expect(elapsedLabel("not-a-date", NOW)).toEqual({ key: "pamInboxElapsedJustNow", value: 0 });
  });
});
