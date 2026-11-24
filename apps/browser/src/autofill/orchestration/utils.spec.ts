import type { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";

import { AutofillOutcome } from "../enums/autofill-outcome.enum";
import type { AutoFillOptions } from "../types";

import type { FillResult } from "./types";
import {
  AUTOFILL_ABSENT,
  AUTOFILL_CANCELLED,
  AUTOFILL_DENIED,
  AUTOFILL_INVALID,
  didFillOccur,
  isFillResult,
  omitProtectedOptions,
  shouldAutoCopyTotp,
} from "./utils";

// The attempts that terminate the request. Each is read as a denial is.
const refusals = [
  AutofillOutcome.Denied,
  AutofillOutcome.Cancelled,
  AutofillOutcome.Invalid,
] as const;

describe("didFillOccur", () => {
  it.each([AutofillOutcome.Filled, AutofillOutcome.Absent])(
    "treats a %s attempt as one the request may continue from",
    (outcome) => {
      expect(didFillOccur({ outcome } as FillResult)).toBe(true);
    },
  );

  it.each(refusals)("treats a %s attempt as terminating the request", (outcome) => {
    expect(didFillOccur({ outcome })).toBe(false);
  });

  // The guard asserts its narrowing, so the compiler trusts it. Testing for the outcomes that did
  // occur keeps an outcome added later out of the set until someone decides it belongs there.
  it("excludes an outcome it does not recognise", () => {
    expect(didFillOccur({ outcome: "deferred" } as unknown as FillResult)).toBe(false);
  });
});

describe("shouldAutoCopyTotp", () => {
  it.each([AutofillOutcome.Filled, AutofillOutcome.Absent])(
    "copies a released code on a %s attempt the user's preference permits",
    (outcome) => {
      expect(
        shouldAutoCopyTotp({ outcome, totp: "123456", canAutoCopyTotp: true } as FillResult),
      ).toBe(true);
    },
  );

  it("copies nothing when the user's preference withholds it", () => {
    expect(
      shouldAutoCopyTotp({
        outcome: AutofillOutcome.Filled,
        totp: "123456",
        canAutoCopyTotp: false,
      }),
    ).toBe(false);
  });

  it("copies nothing when no code was released", () => {
    expect(shouldAutoCopyTotp({ outcome: AutofillOutcome.Filled, canAutoCopyTotp: true })).toBe(
      false,
    );
  });

  it("copies nothing on an outcome carrying neither", () => {
    expect(shouldAutoCopyTotp(AUTOFILL_ABSENT)).toBe(false);
  });

  // The code and the consent are present, so only the outcome can withhold the copy. A refusal
  // releases nothing, and the guard rejects it for its outcome before it reads either.
  it.each(refusals)(
    "copies nothing on a %s attempt, though a code and consent are present",
    (outcome) => {
      expect(
        shouldAutoCopyTotp({
          outcome,
          totp: "123456",
          canAutoCopyTotp: true,
        } as unknown as FillResult),
      ).toBe(false);
    },
  );
});

describe("the constants for a refusal", () => {
  it.each([
    [AUTOFILL_DENIED, AutofillOutcome.Denied],
    [AUTOFILL_CANCELLED, AutofillOutcome.Cancelled],
    [AUTOFILL_INVALID, AutofillOutcome.Invalid],
  ])("name only the outcome they stand for", (result, outcome) => {
    expect(result).toEqual({ outcome });
  });
});

describe("isFillResult", () => {
  it.each([
    AUTOFILL_ABSENT,
    AUTOFILL_CANCELLED,
    AUTOFILL_DENIED,
    AUTOFILL_INVALID,
    { outcome: AutofillOutcome.Filled, totp: "123456" },
  ])("recognises a fill result that names the outcome %j", (result) => {
    expect(isFillResult(result)).toBe(true);
  });

  it.each([
    ["a tab", { id: 1, url: "https://example.com" }],
    ["a plan for a fill", { cipher: {}, cycleKey: "key", options: {} }],
    ["an empty object", {}],
    ["an object that names an outcome autofill does not define", { outcome: "garbage" }],
    ["an object whose outcome is missing", { outcome: undefined }],
  ])("does not mistake %s for one", (_, value) => {
    expect(isFillResult(value)).toBe(false);
  });
});

describe("omitProtectedOptions", () => {
  const caller: Partial<AutoFillOptions> = {
    tab: { id: 1 } as chrome.tabs.Tab,
    cipher: {} as CipherView,
    pageDetails: [],
    allowUntrustedIframe: true,
    autoSubmitLogin: true,
    fillNewPassword: true,
    focusedFieldOpid: "field-1",
  };

  it("keeps the options a caller may give, and leaves out the rest", () => {
    expect(omitProtectedOptions(caller)).toEqual({
      fillNewPassword: true,
      focusedFieldOpid: "field-1",
    });
  });

  it("freezes the options it returns, and leaves the caller's as they were", () => {
    const options = omitProtectedOptions(caller);

    expect(Object.isFrozen(options)).toBe(true);
    expect(caller).toEqual(expect.objectContaining({ autoSubmitLogin: true, pageDetails: [] }));
  });

  it("is no options when the caller gives none", () => {
    expect(omitProtectedOptions()).toEqual({});
  });
});
