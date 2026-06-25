import { LOCALE_KEY } from "../../services/i18n.service";
import { THEME_SELECTION } from "../../theming/theme-state.service";
import { lookupOverlay, __resetOverlaysForTests } from "../managed-overlay-registry";

import { registerAppearanceOverlay } from "./appearance.overlay";

beforeEach(() => {
  __resetOverlaysForTests();
});

describe("registerAppearanceOverlay", () => {
  it("registers an overlay for THEME_SELECTION", () => {
    registerAppearanceOverlay();
    expect(lookupOverlay(THEME_SELECTION)).not.toBeUndefined();
  });

  it("registers an overlay for LOCALE_KEY", () => {
    registerAppearanceOverlay();
    expect(lookupOverlay(LOCALE_KEY)).not.toBeUndefined();
  });

  it("theme overlay coerces a valid theme value", () => {
    registerAppearanceOverlay();
    const overlay = lookupOverlay(THEME_SELECTION)!;
    expect(overlay.coerce((k) => (k === "theming.selection" ? '"light"' : undefined))).toBe(
      "light",
    );
  });

  it("theme overlay rejects an unlisted theme value", () => {
    registerAppearanceOverlay();
    const overlay = lookupOverlay(THEME_SELECTION)!;
    expect(overlay.coerce((k) => (k === "theming.selection" ? '"purple"' : undefined))).toBeNull();
  });

  it("locale overlay coerces a valid string", () => {
    registerAppearanceOverlay();
    const overlay = lookupOverlay(LOCALE_KEY)!;
    expect(overlay.coerce((k) => (k === "translation.locale" ? '"en-US"' : undefined))).toBe(
      "en-US",
    );
  });

  it("is idempotent when called twice", () => {
    registerAppearanceOverlay();
    registerAppearanceOverlay();
    expect(lookupOverlay(THEME_SELECTION)).not.toBeUndefined();
    expect(lookupOverlay(LOCALE_KEY)).not.toBeUndefined();
  });
});
