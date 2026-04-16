import { getDeviceLastActivityDateI18nKey } from "./get-device-last-activity-date-i18n-key.func";

describe("getDeviceLastActivityDateI18nKey", () => {
  // Fixed reference point: Thursday March 26, 2026 at 2:00 PM local time
  const now = new Date(2026, 2, 26, 14, 0, 0);

  it("returns null when lastActivityDate is null", () => {
    expect(getDeviceLastActivityDateI18nKey(null, now)).toBeNull();
  });

  describe("recentlyActiveToday", () => {
    it("returns 'recentlyActiveToday' when activity was earlier the same calendar day", () => {
      const date = new Date(2026, 2, 26, 8, 0, 0); // same day, 8 AM
      expect(getDeviceLastActivityDateI18nKey(date, now)).toBe("recentlyActiveToday");
    });

    it("returns 'recentlyActiveToday' when activity was early the same calendar day", () => {
      // 1 AM same day — elapsed time is 13 hours, but it's still the same calendar day
      const date = new Date(2026, 2, 26, 1, 0, 0);
      expect(getDeviceLastActivityDateI18nKey(date, now)).toBe("recentlyActiveToday");
    });

    it("returns 'recentlyActiveToday' when activity timestamp is later the same calendar day", () => {
      // 11 PM same day — daysAgo is still 0 regardless of the time ordering
      const date = new Date(2026, 2, 26, 23, 0, 0);
      expect(getDeviceLastActivityDateI18nKey(date, now)).toBe("recentlyActiveToday");
    });

    it("returns 'recentlyActiveToday' when activity date is one calendar day in the future (server clock skew)", () => {
      // Server clock is 1 day ahead — daysAgo is -1, should still bucket as "today"
      const date = new Date(2026, 2, 27, 14, 0, 0);
      expect(getDeviceLastActivityDateI18nKey(date, now)).toBe("recentlyActiveToday");
    });
  });

  describe("recentlyActivePast7Days", () => {
    it("returns 'recentlyActivePast7Days' when activity was 1 calendar day ago", () => {
      const date = new Date(2026, 2, 25, 23, 59, 0); // Wednesday at 11:59 PM — was 'Today' with elapsed-ms
      expect(getDeviceLastActivityDateI18nKey(date, now)).toBe("recentlyActivePast7Days");
    });

    it("returns 'recentlyActivePast7Days' when activity was 3 calendar days ago", () => {
      const date = new Date(2026, 2, 23, 14, 0, 0);
      expect(getDeviceLastActivityDateI18nKey(date, now)).toBe("recentlyActivePast7Days");
    });

    it("returns 'recentlyActivePast7Days' when activity was 6 calendar days ago", () => {
      const date = new Date(2026, 2, 20, 14, 0, 0);
      expect(getDeviceLastActivityDateI18nKey(date, now)).toBe("recentlyActivePast7Days");
    });
  });

  describe("recentlyActivePast14Days", () => {
    it("returns 'recentlyActivePast14Days' when activity was 7 calendar days ago", () => {
      const date = new Date(2026, 2, 19, 14, 0, 0);
      expect(getDeviceLastActivityDateI18nKey(date, now)).toBe("recentlyActivePast14Days");
    });

    it("returns 'recentlyActivePast14Days' when activity was 13 calendar days ago", () => {
      const date = new Date(2026, 2, 13, 14, 0, 0);
      expect(getDeviceLastActivityDateI18nKey(date, now)).toBe("recentlyActivePast14Days");
    });
  });

  describe("recentlyActivePast30Days", () => {
    it("returns 'recentlyActivePast30Days' when activity was 14 calendar days ago", () => {
      const date = new Date(2026, 2, 12, 14, 0, 0);
      expect(getDeviceLastActivityDateI18nKey(date, now)).toBe("recentlyActivePast30Days");
    });

    it("returns 'recentlyActivePast30Days' when activity was 29 calendar days ago", () => {
      const date = new Date(2026, 1, 25, 14, 0, 0);
      expect(getDeviceLastActivityDateI18nKey(date, now)).toBe("recentlyActivePast30Days");
    });
  });

  describe("recentlyActiveOver30Days", () => {
    it("returns 'recentlyActiveOver30Days' when activity was 30 calendar days ago", () => {
      const date = new Date(2026, 1, 24, 14, 0, 0);
      expect(getDeviceLastActivityDateI18nKey(date, now)).toBe("recentlyActiveOver30Days");
    });

    it("returns 'recentlyActiveOver30Days' when activity was 60 calendar days ago", () => {
      const date = new Date(2026, 0, 25, 14, 0, 0);
      expect(getDeviceLastActivityDateI18nKey(date, now)).toBe("recentlyActiveOver30Days");
    });
  });

  it("uses the current time by default (smoke test)", () => {
    const date = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago, same calendar day
    expect(getDeviceLastActivityDateI18nKey(date)).toBe("recentlyActiveToday");
  });

  describe("timezone safety: day-counting uses local calendar dates, not UTC", () => {
    // These tests guard against a UTC-based implementation where a late-night local timestamp
    // rolls over to the next UTC date, causing the day count to be off by one at bucket boundaries.

    it("counts 7 days (week boundary) correctly when activity was at 11 PM local — a time that shifts to the next UTC date in negative-offset zones", () => {
      // Example in UTC-8 (PST):
      //   Activity : March 31  11 PM local  →  April 1  07:00 UTC
      //   Now      : April 7    1 AM local  →  April 7  09:00 UTC
      //
      // UTC-based calc: April 7 − April 1 = 6 days  →  "recentlyActivePast7Days"  ← wrong
      // Local-calendar: April 7 − March 31 = 7 days  →  "recentlyActivePast14Days"  ← correct
      const date = new Date(2026, 2, 31, 23, 0, 0); // March 31 at 11 PM local
      const now = new Date(2026, 3, 7, 1, 0, 0); // April 7 at 1 AM local
      expect(getDeviceLastActivityDateI18nKey(date, now)).toBe("recentlyActivePast14Days");
    });

    it("counts 30 days (month boundary) correctly when activity was at 11 PM local — a time that shifts to the next UTC date in negative-offset zones", () => {
      // Example in UTC-8 (PST):
      //   Activity : April 29  11 PM local  →  April 30  UTC
      //   Now      : May 29     1 AM local  →  May 29    UTC
      //
      // UTC-based calc: May 29 − April 30 = 29 days  →  "recentlyActivePast30Days"  ← wrong
      // Local-calendar: May 29 − April 29 = 30 days  →  "recentlyActiveOver30Days"  ← correct
      const date = new Date(2026, 3, 29, 23, 0, 0); // April 29 at 11 PM local
      const now = new Date(2026, 4, 29, 1, 0, 0); // May 29 at 1 AM local
      expect(getDeviceLastActivityDateI18nKey(date, now)).toBe("recentlyActiveOver30Days");
    });
  });

  describe("DST transitions: Math.round guards against a 23-hour day shrinking the day count", () => {
    // When clocks spring forward, the midnight-to-midnight gap for that calendar day is only 23h.
    // A 7-day span that includes that transition totals 167h instead of 168h.
    // Math.floor(167 / 24) = 6  →  wrong bucket
    // Math.round(167 / 24) = 7  →  correct
    // (On non-DST machines the gap is always 24h, so the test still passes — it just doesn't
    //  exercise the rounding path.)

    it("counts 7 days correctly when the span crosses the US spring-forward transition (March 7→8, 2026)", () => {
      // US DST springs forward on March 8, 2026 (second Sunday of March):
      // clocks jump 2 AM → 3 AM, so March 7 midnight → March 8 midnight is only 23h.
      // March 2 midnight → March 9 midnight = 6 × 24h + 23h = 167h total.
      const date = new Date(2026, 2, 2, 0, 0, 0); // March 2 midnight
      const now = new Date(2026, 2, 9, 0, 0, 0); // March 9 midnight
      expect(getDeviceLastActivityDateI18nKey(date, now)).toBe("recentlyActivePast14Days");
    });
  });
});
