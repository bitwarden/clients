import {
  __resetOverlaysForTests,
  lookupOverlay,
} from "@bitwarden/common/platform/managed-settings/managed-overlay-registry";

/* eslint-disable no-restricted-imports */
import { COPY_BUTTON } from "../../vault/popup/services/vault-popup-copy-buttons.service";
import { COMPACT_MODE } from "../popup/layout/popup-compact-mode.service";
/* eslint-enable no-restricted-imports */

import { registerBrowserAppearanceOverlay } from "./browser-appearance.overlay";

beforeEach(() => {
  __resetOverlaysForTests();
});

describe("registerBrowserAppearanceOverlay", () => {
  it("registers an overlay for COMPACT_MODE", () => {
    registerBrowserAppearanceOverlay();
    expect(lookupOverlay(COMPACT_MODE)).not.toBeUndefined();
  });

  it("registers an overlay for COPY_BUTTON", () => {
    registerBrowserAppearanceOverlay();
    expect(lookupOverlay(COPY_BUTTON)).not.toBeUndefined();
  });

  it("compact mode overlay coerces a boolean value", () => {
    registerBrowserAppearanceOverlay();
    const overlay = lookupOverlay(COMPACT_MODE)!;
    expect(overlay.coerce((k) => (k === "theming.compactMode" ? "true" : undefined))).toBe(true);
  });

  it("copy button overlay coerces a valid mode", () => {
    registerBrowserAppearanceOverlay();
    const overlay = lookupOverlay(COPY_BUTTON)!;
    expect(
      overlay.coerce((k) => (k === "vaultAppearance.copyButtons" ? '"quick"' : undefined)),
    ).toBe("quick");
  });

  it("copy button overlay rejects an unlisted mode", () => {
    registerBrowserAppearanceOverlay();
    const overlay = lookupOverlay(COPY_BUTTON)!;
    expect(
      overlay.coerce((k) => (k === "vaultAppearance.copyButtons" ? '"hidden"' : undefined)),
    ).toBeNull();
  });

  it("is idempotent when called twice", () => {
    registerBrowserAppearanceOverlay();
    registerBrowserAppearanceOverlay();
    expect(lookupOverlay(COMPACT_MODE)).not.toBeUndefined();
    expect(lookupOverlay(COPY_BUTTON)).not.toBeUndefined();
  });
});
