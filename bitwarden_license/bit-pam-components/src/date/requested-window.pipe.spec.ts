import { LOCALE_ID } from "@angular/core";
import { TestBed } from "@angular/core/testing";

import { I18nService } from "@bitwarden/common/platform/abstractions/i18n.service";

import { RequestedWindowPipe } from "./requested-window.pipe";

/** Resolves the three window keys, so the assertions read as the rendered sentence. */
const i18nService = {
  t: (key: string, ...args: string[]) => {
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
  },
};

function pipeFor(locale: string): RequestedWindowPipe {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      RequestedWindowPipe,
      { provide: LOCALE_ID, useValue: locale },
      { provide: I18nService, useValue: i18nService },
    ],
  });
  return TestBed.inject(RequestedWindowPipe);
}

function at(year: number, month: number, day: number, hour: number, minute = 0): number {
  return new Date(year, month - 1, day, hour, minute, 0, 0).getTime();
}

const NOW = at(2026, 8, 20, 9, 0);

describe("RequestedWindowPipe", () => {
  it("formats a future window as a range", () => {
    const text = pipeFor("en-US").transform(at(2026, 8, 25, 9, 0), at(2026, 8, 25, 10, 0), NOW);

    expect(text).toBe("Aug 25, 2026, 9 AM to 10 AM");
  });

  it("formats a window already open as its end alone", () => {
    const text = pipeFor("en-US").transform(at(2026, 8, 20, 8, 0), at(2026, 8, 20, 20, 7), NOW);

    expect(text).toBe("Until 8:07 PM");
  });

  it("takes the bounds as ISO strings too, since the two row types carry them differently", () => {
    const pipe = pipeFor("en-US");
    const fromMs = pipe.transform(at(2026, 8, 25, 9, 0), at(2026, 8, 25, 10, 0), NOW);
    const fromIso = pipe.transform(
      new Date(at(2026, 8, 25, 9, 0)).toISOString(),
      new Date(at(2026, 8, 25, 10, 0)).toISOString(),
      NOW,
    );

    expect(fromIso).toBe(fromMs);
  });

  it("follows the app's locale, not the browser's", () => {
    const american = pipeFor("en-US").transform(at(2026, 8, 25, 9, 0), at(2026, 8, 25, 10, 0), NOW);
    const german = pipeFor("de-DE").transform(at(2026, 8, 25, 9, 0), at(2026, 8, 25, 10, 0), NOW);

    expect(german).not.toBe(american);
  });

  it("says nothing for an unparseable bound rather than rendering Invalid Date", () => {
    expect(pipeFor("en-US").transform("not a date", at(2026, 8, 25, 10, 0), NOW)).toBe("");
  });
});
