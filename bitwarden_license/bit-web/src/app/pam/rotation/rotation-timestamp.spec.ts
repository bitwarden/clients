import { formatRotationAge } from "./rotation-timestamp";

describe("rotation timestamps", () => {
  it("states how long ago in whole days", () => {
    const now = Date.parse("2026-10-04T12:00:00Z");
    expect(formatRotationAge("2026-10-01T12:00:00Z", now)).toBe("3 days ago");
  });
});
