import type { CipherAccessStateView } from "@bitwarden/sdk-internal";

import { PamInputError } from "../shared/pam-input-error";

import { LEASE_ENDED_MESSAGE, validateExtension } from "./lease-extension";

function accessState(overrides: Partial<CipherAccessStateView> = {}): CipherAccessStateView {
  return {
    extensionsAllowed: true,
    maxExtensionDurationSeconds: undefined,
    ...overrides,
  } as CipherAccessStateView;
}

describe("validateExtension", () => {
  it("refuses when extensions are not allowed", () => {
    const state = accessState({ extensionsAllowed: false });
    expect(() => validateExtension(state, 60)).toThrow(
      new PamInputError("This lease cannot be extended."),
    );
  });

  it("throws a PamInputError so callers can print the message safely", () => {
    expect(() => validateExtension(accessState({ extensionsAllowed: false }), 60)).toThrow(
      PamInputError,
    );
  });

  it("refuses for a disallowed extension before looking at the maximum", () => {
    const state = accessState({ extensionsAllowed: false, maxExtensionDurationSeconds: 3600 });
    expect(() => validateExtension(state, 10)).toThrow("This lease cannot be extended.");
  });

  it("accepts any duration when there is no maximum", () => {
    expect(() =>
      validateExtension(accessState({ maxExtensionDurationSeconds: undefined }), 1_000_000),
    ).not.toThrow();
  });

  it("treats a null maximum as no maximum", () => {
    const state = accessState({
      maxExtensionDurationSeconds: null as unknown as undefined,
    });
    expect(() => validateExtension(state, 1_000_000)).not.toThrow();
  });

  it("accepts a duration under the maximum", () => {
    expect(() =>
      validateExtension(accessState({ maxExtensionDurationSeconds: 3600 }), 1800),
    ).not.toThrow();
  });

  it("accepts a duration equal to the maximum", () => {
    expect(() =>
      validateExtension(accessState({ maxExtensionDurationSeconds: 3600 }), 3600),
    ).not.toThrow();
  });

  it("refuses a duration over the maximum and names the maximum", () => {
    const state = accessState({ maxExtensionDurationSeconds: 3600 });
    expect(() => validateExtension(state, 3601)).toThrow(
      new PamInputError("The extension cannot be longer than 3600 seconds."),
    );
  });

  it("enforces a maximum of zero rather than treating it as unset", () => {
    const state = accessState({ maxExtensionDurationSeconds: 0 });
    expect(() => validateExtension(state, 1)).toThrow(
      "The extension cannot be longer than 0 seconds.",
    );
  });

  it("exposes the message used when the lease has ended", () => {
    expect(LEASE_ENDED_MESSAGE).toBe("The lease has ended, so it cannot be extended.");
  });
});
