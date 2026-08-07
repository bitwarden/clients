import { RemainingTimePipe } from "./remaining-time.pipe";

describe("RemainingTimePipe", () => {
  const pipe = new RemainingTimePipe();

  // The exhaustive ms-formatting cases live in format-remaining.spec.ts; these cover the
  // notAfter/now wiring the pipe adds on top.
  it("formats the remaining time until notAfter relative to nowMs", () => {
    const now = Date.parse("2026-01-01T00:00:00.000Z");
    const notAfter = "2026-01-01T02:05:00.000Z"; // 2h 5m later

    expect(pipe.transform(notAfter, now)).toBe("2h 5m");
  });

  it("returns 0s once notAfter has passed", () => {
    const now = Date.parse("2026-01-01T03:00:00.000Z");
    const notAfter = "2026-01-01T02:00:00.000Z";

    expect(pipe.transform(notAfter, now)).toBe("0s");
  });

  it("returns 0s for an unparseable date", () => {
    expect(pipe.transform("not-a-date", Date.parse("2026-01-01T00:00:00.000Z"))).toBe("0s");
  });
});
