import {
  lookupOverlay,
  __resetOverlaysForTests,
} from "../../platform/managed-settings/managed-overlay-registry";
import { ENABLE_CONTEXT_MENU, INLINE_MENU_VISIBILITY } from "../services/autofill-settings.service";
import { SHOW_FAVICONS } from "../services/domain-settings.service";
import {
  ENABLE_ADDED_LOGIN_PROMPT,
  ENABLE_CHANGED_PASSWORD_PROMPT,
} from "../services/user-notification-settings.service";

import { registerAutofillOverlay } from "./autofill.overlay";

beforeEach(() => {
  __resetOverlaysForTests();
});

describe("registerAutofillOverlay", () => {
  it("registers an overlay for INLINE_MENU_VISIBILITY", () => {
    registerAutofillOverlay();
    expect(lookupOverlay(INLINE_MENU_VISIBILITY)).not.toBeUndefined();
  });

  it("registers an overlay for ENABLE_CONTEXT_MENU", () => {
    registerAutofillOverlay();
    expect(lookupOverlay(ENABLE_CONTEXT_MENU)).not.toBeUndefined();
  });

  it("registers an overlay for ENABLE_ADDED_LOGIN_PROMPT", () => {
    registerAutofillOverlay();
    expect(lookupOverlay(ENABLE_ADDED_LOGIN_PROMPT)).not.toBeUndefined();
  });

  it("registers an overlay for ENABLE_CHANGED_PASSWORD_PROMPT", () => {
    registerAutofillOverlay();
    expect(lookupOverlay(ENABLE_CHANGED_PASSWORD_PROMPT)).not.toBeUndefined();
  });

  it("registers an overlay for SHOW_FAVICONS", () => {
    registerAutofillOverlay();
    expect(lookupOverlay(SHOW_FAVICONS)).not.toBeUndefined();
  });

  it("inlineMenuVisibility overlay coerces a valid value", () => {
    registerAutofillOverlay();
    const overlay = lookupOverlay(INLINE_MENU_VISIBILITY)!;
    expect(overlay.coerce((k) => (k === "autofill.inlineMenuVisibility" ? "2" : undefined))).toBe(
      2,
    );
  });

  it("inlineMenuVisibility overlay rejects an out-of-range value", () => {
    registerAutofillOverlay();
    const overlay = lookupOverlay(INLINE_MENU_VISIBILITY)!;
    expect(
      overlay.coerce((k) => (k === "autofill.inlineMenuVisibility" ? "3" : undefined)),
    ).toBeNull();
  });

  it("inlineMenuVisibility overlay rejects a non-numeric value", () => {
    registerAutofillOverlay();
    const overlay = lookupOverlay(INLINE_MENU_VISIBILITY)!;
    expect(
      overlay.coerce((k) => (k === "autofill.inlineMenuVisibility" ? '"on"' : undefined)),
    ).toBeNull();
  });

  it("boolean overlay coerces true for a boolean key", () => {
    registerAutofillOverlay();
    const overlay = lookupOverlay(ENABLE_CONTEXT_MENU)!;
    expect(overlay.coerce((k) => (k === "autofill.contextMenu" ? "true" : undefined))).toBe(true);
  });

  it("boolean overlay rejects a non-boolean value", () => {
    registerAutofillOverlay();
    const overlay = lookupOverlay(ENABLE_CONTEXT_MENU)!;
    expect(overlay.coerce((k) => (k === "autofill.contextMenu" ? '"x"' : undefined))).toBeNull();
  });

  it("is idempotent when called twice", () => {
    registerAutofillOverlay();
    registerAutofillOverlay();
    expect(lookupOverlay(INLINE_MENU_VISIBILITY)).not.toBeUndefined();
    expect(lookupOverlay(ENABLE_CONTEXT_MENU)).not.toBeUndefined();
    expect(lookupOverlay(ENABLE_ADDED_LOGIN_PROMPT)).not.toBeUndefined();
    expect(lookupOverlay(ENABLE_CHANGED_PASSWORD_PROMPT)).not.toBeUndefined();
    expect(lookupOverlay(SHOW_FAVICONS)).not.toBeUndefined();
  });
});
