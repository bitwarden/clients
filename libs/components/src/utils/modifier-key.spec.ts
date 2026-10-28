import { Signal } from "@angular/core";
import { TestBed } from "@angular/core/testing";

import { injectModifierGlyph, injectModifierKey } from "./modifier-key";

/**
 * jsdom reports a Linux-ish `navigator`, so the Mac seed has to be faked. `navigator.platform` is
 * readonly, hence `defineProperty` rather than assignment.
 */
const setPlatform = (platform: string, userAgent: string) => {
  Object.defineProperty(window.navigator, "platform", { value: platform, configurable: true });
  Object.defineProperty(window.navigator, "userAgent", { value: userAgent, configurable: true });
};

const asMac = () => setPlatform("MacIntel", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)");
const asWindows = () => setPlatform("Win32", "Mozilla/5.0 (Windows NT 10.0; Win64; x64)");

const keydown = (init: KeyboardEventInit) =>
  document.dispatchEvent(new KeyboardEvent("keydown", init));

describe("injectModifierKey", () => {
  const { platform, userAgent } = window.navigator;

  afterEach(() => setPlatform(platform, userAgent));

  const create = (): Signal<"Command" | "Ctrl"> =>
    TestBed.runInInjectionContext(() => injectModifierKey());

  it("seeds Command from a Mac navigator", () => {
    asMac();

    expect(create()()).toBe("Command");
  });

  it("seeds Command from a Mac user agent alone", () => {
    setPlatform("", "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)");

    expect(create()()).toBe("Command");
  });

  it("seeds Ctrl everywhere else", () => {
    asWindows();

    expect(create()()).toBe("Ctrl");
  });

  it("corrects a wrong Ctrl seed on a Cmd chord", () => {
    asWindows();
    const key = create();

    keydown({ key: "f", metaKey: true });

    expect(key()).toBe("Command");
  });

  // The macOS caret bindings — Ctrl+A/E/K/D — fire while typing in any input and still reach the
  // document, so a Ctrl chord says nothing about the platform.
  it.each(["a", "e", "k", "d"])("keeps Command when a Mac user presses Ctrl+%s", (letter) => {
    asMac();
    const key = create();

    keydown({ key: letter, ctrlKey: true });

    expect(key()).toBe("Command");
  });

  it("keeps Ctrl on a Ctrl chord", () => {
    asWindows();
    const key = create();

    keydown({ key: "f", ctrlKey: true });

    expect(key()).toBe("Ctrl");
  });

  // The Windows key reports `key: "Meta"` with `metaKey: true`, which would otherwise look like Cmd.
  it("ignores a bare Meta press", () => {
    asWindows();
    const key = create();

    keydown({ key: "Meta", metaKey: true });

    expect(key()).toBe("Ctrl");
  });

  it("ignores a bare Control press", () => {
    asMac();
    const key = create();

    keydown({ key: "Control", ctrlKey: true });

    expect(key()).toBe("Command");
  });

  it("ignores Cmd+Ctrl chords, which are ambiguous", () => {
    asWindows();
    const key = create();

    keydown({ key: "f", metaKey: true, ctrlKey: true });

    expect(key()).toBe("Ctrl");
  });
});

describe("injectModifierGlyph", () => {
  const { platform, userAgent } = window.navigator;

  afterEach(() => setPlatform(platform, userAgent));

  const create = (): Signal<string> => TestBed.runInInjectionContext(() => injectModifierGlyph());

  it("renders the Command glyph on a Mac", () => {
    asMac();

    expect(create()()).toBe("⌘");
  });

  it("renders Ctrl elsewhere", () => {
    asWindows();

    expect(create()()).toBe("Ctrl");
  });

  it("follows the key signal", () => {
    asWindows();
    const glyph = create();

    keydown({ key: "f", metaKey: true });

    expect(glyph()).toBe("⌘");
  });
});
