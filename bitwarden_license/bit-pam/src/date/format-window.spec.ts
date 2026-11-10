import { formatRequestedWindow, formatWindowDay, windowParts } from "./format-window";

function at(year: number, month: number, day: number, hour: number, minute = 0): number {
  return new Date(year, month - 1, day, hour, minute, 0, 0).getTime();
}

const NOW = at(2026, 8, 20, 9, 0);

describe("formatWindowDay", () => {
  it("says nothing for today, which the row is already read on", () => {
    expect(formatWindowDay("en-US", at(2026, 8, 20, 17, 0), NOW)).toBe("");
  });

  it("words the days either side of today", () => {
    expect(formatWindowDay("en-US", at(2026, 8, 21, 9, 0), NOW)).toBe("Tomorrow");
    expect(formatWindowDay("en-US", at(2026, 8, 19, 9, 0), NOW)).toBe("Yesterday");
  });

  it("dates anything further out", () => {
    expect(formatWindowDay("en-US", at(2026, 8, 25, 9, 0), NOW)).toBe("Aug 25, 2026");
    expect(formatWindowDay("en-US", at(2026, 9, 2, 9, 0), NOW)).toBe("Sept 2, 2026");
  });

  it("counts calendar days rather than elapsed hours", () => {
    expect(formatWindowDay("en-US", at(2026, 8, 20, 23, 59), NOW)).toBe("");
    expect(formatWindowDay("en-US", at(2026, 8, 21, 0, 1), NOW)).toBe("Tomorrow");
  });
});

describe("windowParts", () => {
  it("leaves a window inside today with bare times", () => {
    const parts = windowParts("en-US", at(2026, 8, 20, 17, 11), at(2026, 8, 20, 19, 11), NOW);

    expect(parts).toEqual({
      sharedDay: "",
      start: { day: "", time: "5:11 PM" },
      end: { day: "", time: "7:11 PM" },
    });
  });

  it("states a shared day once, in front of the range", () => {
    const parts = windowParts("en-US", at(2026, 8, 21, 9, 0), at(2026, 8, 21, 13, 0), NOW);

    expect(parts).toEqual({
      sharedDay: "Tomorrow",
      start: { day: "", time: "9 AM" },
      end: { day: "", time: "1 PM" },
    });
  });

  it("dates a shared day that is neither today nor tomorrow", () => {
    const parts = windowParts("en-US", at(2026, 8, 25, 9, 0), at(2026, 8, 25, 13, 0), NOW);

    expect(parts.sharedDay).toBe("Aug 25, 2026");
  });

  it("gives each end its own day when the window spans days", () => {
    const parts = windowParts("en-US", at(2026, 8, 25, 9, 0), at(2026, 8, 26, 13, 0), NOW);

    expect(parts).toEqual({
      sharedDay: "",
      start: { day: "Aug 25, 2026", time: "9 AM" },
      end: { day: "Aug 26, 2026", time: "1 PM" },
    });
  });

  it("day-qualifies a window that runs from today into tomorrow", () => {
    const parts = windowParts("en-US", at(2026, 8, 20, 22, 0), at(2026, 8, 21, 2, 0), NOW);

    expect(parts.sharedDay).toBe("");
    expect(parts.start).toEqual({ day: "", time: "10 PM" });
    expect(parts.end).toEqual({ day: "Tomorrow", time: "2 AM" });
  });
});

describe("formatRequestedWindow", () => {
  /** Stands in for the i18n service: resolves the three window keys the formatter uses. */
  const translate = (key: string, ...args: string[]): string => {
    switch (key) {
      case "pamWindowOpenUntil":
        return `Until ${args[0]}`;
      case "pamWindowRange":
        return `${args[0]} to ${args[1]}`;
      case "pamWindowOnDay":
        return `${args[0]}, ${args[1]}`;
      default:
        return key;
    }
  };
  const render = (locale: string, start: number, end: number, now = NOW) =>
    formatRequestedWindow(translate, locale, start, end, now);

  it("reads an open window as its end alone", () => {
    expect(render("en-US", at(2026, 8, 20, 8, 0), at(2026, 8, 20, 20, 7))).toBe("Until 8:07 PM");
  });

  it("dates the end of an open window that runs past today", () => {
    expect(render("en-US", at(2026, 8, 20, 8, 0), at(2026, 8, 22, 9, 0))).toBe(
      "Until Aug 22, 2026, 9 AM",
    );
  });

  it("lifts a shared day out in front of a window still to open", () => {
    expect(render("en-US", at(2026, 8, 21, 9, 0), at(2026, 8, 21, 13, 0))).toBe(
      "Tomorrow, 9 AM to 1 PM",
    );
  });

  it("drops the day for a later window today, which the row is already read on", () => {
    expect(render("en-US", at(2026, 8, 20, 14, 30), at(2026, 8, 20, 16, 0))).toBe(
      "2:30 PM to 4 PM",
    );
  });

  it("dates a single-day window further out", () => {
    expect(render("en-US", at(2026, 8, 25, 9, 0), at(2026, 8, 25, 10, 0))).toBe(
      "Aug 25, 2026, 9 AM to 10 AM",
    );
  });

  it("dates both ends of a future window spanning days", () => {
    expect(render("en-US", at(2026, 8, 25, 9, 0), at(2026, 8, 26, 13, 0))).toBe(
      "Aug 25, 2026, 9 AM to Aug 26, 2026, 1 PM",
    );
  });

  it("says nothing for an unparseable bound rather than rendering Invalid Date", () => {
    expect(formatRequestedWindow(translate, "en-US", Number.NaN, at(2026, 8, 20, 10, 0), NOW)).toBe(
      "",
    );
  });
});
