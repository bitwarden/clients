import { AutofillOutcome } from "../enums/autofill-outcome.enum";

import {
  AUTOFILL_ABSENT,
  AUTOFILL_DENIED,
  didFillOccur,
  FillResult,
  shouldAutoCopyTotp,
} from "./fill-result";

describe("didFillOccur", () => {
  it.each([AutofillOutcome.Filled, AutofillOutcome.Absent])(
    "treats a %s attempt as one the request may continue from",
    (outcome) => {
      expect(didFillOccur({ outcome } as FillResult)).toBe(true);
    },
  );

  it("treats a denial as terminating the request", () => {
    expect(didFillOccur(AUTOFILL_DENIED)).toBe(false);
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

  // A denial has no `totp` to read, so the guard must reject it without inspecting one.
  it("copies nothing on a denial", () => {
    expect(shouldAutoCopyTotp(AUTOFILL_DENIED)).toBe(false);
  });
});
