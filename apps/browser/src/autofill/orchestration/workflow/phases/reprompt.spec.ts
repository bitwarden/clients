import { CipherRepromptType } from "@bitwarden/common/vault/enums/cipher-reprompt-type";

import { NEVER_CANCEL } from "../../../utils/cancellation";
import { AUTOFILL_DENIED, AUTOFILL_INVALID } from "../../utils";
import type { FillContext, FillSelection } from "../context";
import { CipherSource, RepromptAction } from "../enums";
import { cipherOf, contextOf, fakeServices, tab, URL } from "../fakes.spec-util";

import { askReprompt, confirmedReprompt, refuseReprompt, repromptPhase } from "./reprompt";

/** A context whose selection has `reprompt`, from `source`, cycling under `URL` unless `null`. */
function selectionOf(
  reprompt: CipherRepromptType,
  source: CipherSource = CipherSource.Login,
  rotation: string | null = URL,
): FillContext {
  const selection: FillSelection = {
    cipher: cipherOf("selected", { reprompt }),
    source,
    ...(rotation === null ? {} : { rotation }),
  };
  return contextOf({ selection });
}

describe("repromptPhase", () => {
  it("builds the asking reprompt, cycling as the plan says", async () => {
    const f = fakeServices();
    f.autofillService.isPasswordRepromptRequired.mockResolvedValue(true);

    const phase = repromptPhase({ action: RepromptAction.Ask, cycleOnDenial: false }, f.services);
    const result = await phase.execute(selectionOf(CipherRepromptType.Password), NEVER_CANCEL);

    expect(result).toBe(AUTOFILL_DENIED);
    expect(f.fillCipherPolicy.advanceRotation).not.toHaveBeenCalled();
  });

  it("builds the refusing reprompt", async () => {
    const f = fakeServices();

    const phase = repromptPhase({ action: RepromptAction.Refuse }, f.services);

    expect(await phase.check(selectionOf(CipherRepromptType.Password), NEVER_CANCEL)).toBe(
      AUTOFILL_DENIED,
    );
  });

  it("builds the confirmed reprompt", async () => {
    const f = fakeServices();

    const phase = repromptPhase({ action: RepromptAction.Confirmed }, f.services);

    expect(await phase.check(selectionOf(CipherRepromptType.Password), NEVER_CANCEL)).toBe(
      AUTOFILL_INVALID,
    );
  });
});

describe("askReprompt", () => {
  it("lets every fill through its check, even one whose cipher requires a reprompt", async () => {
    const result = await askReprompt(fakeServices().services, true).check(
      selectionOf(CipherRepromptType.Password),
      NEVER_CANCEL,
    );

    expect(result).toBeUndefined();
  });

  it("lets the fill continue, cycling nothing, when no reprompt is required", async () => {
    const f = fakeServices();

    const result = await askReprompt(f.services, true).execute(
      selectionOf(CipherRepromptType.None),
      NEVER_CANCEL,
    );

    expect(result).toEqual({});
    expect(f.autofillService.isPasswordRepromptRequired).toHaveBeenCalledWith(
      expect.objectContaining({ reprompt: CipherRepromptType.None }),
      tab,
    );
    expect(f.fillCipherPolicy.advanceRotation).not.toHaveBeenCalled();
  });

  it("denies the fill, and cycles past the cipher, when the user is asked and it cycles on refusal", async () => {
    const f = fakeServices();
    f.autofillService.isPasswordRepromptRequired.mockResolvedValue(true);

    const result = await askReprompt(f.services, true).execute(
      selectionOf(CipherRepromptType.Password),
      NEVER_CANCEL,
    );

    expect(result).toBe(AUTOFILL_DENIED);
    expect(f.fillCipherPolicy.advanceRotation).toHaveBeenCalledWith(URL);
  });

  it("denies the fill, and cycles nothing, when the user is asked and it does not cycle", async () => {
    const f = fakeServices();
    f.autofillService.isPasswordRepromptRequired.mockResolvedValue(true);

    const result = await askReprompt(f.services, false).execute(
      selectionOf(CipherRepromptType.Password),
      NEVER_CANCEL,
    );

    expect(result).toBe(AUTOFILL_DENIED);
    expect(f.fillCipherPolicy.advanceRotation).not.toHaveBeenCalled();
  });

  it("cycles nothing for a cipher without a rotation", async () => {
    const f = fakeServices();
    f.autofillService.isPasswordRepromptRequired.mockResolvedValue(true);

    const result = await askReprompt(f.services, true).execute(
      selectionOf(CipherRepromptType.Password, CipherSource.Login, null),
      NEVER_CANCEL,
    );

    expect(result).toBe(AUTOFILL_DENIED);
    expect(f.fillCipherPolicy.advanceRotation).not.toHaveBeenCalled();
  });
});

describe("refuseReprompt", () => {
  it("denies a cipher that requires a reprompt", async () => {
    const result = await refuseReprompt().check(
      selectionOf(CipherRepromptType.Password),
      NEVER_CANCEL,
    );

    expect(result).toBe(AUTOFILL_DENIED);
  });

  it("lets a cipher that requires no reprompt continue", async () => {
    const phase = refuseReprompt();

    expect(await phase.check(selectionOf(CipherRepromptType.None), NEVER_CANCEL)).toBeUndefined();
    expect(await phase.execute(selectionOf(CipherRepromptType.None), NEVER_CANCEL)).toEqual({});
  });
});

describe("confirmedReprompt", () => {
  it.each<[string, CipherRepromptType, CipherSource]>([
    [
      "a requested cipher that requires a reprompt",
      CipherRepromptType.Password,
      CipherSource.FillRequest,
    ],
    ["a requested cipher that requires none", CipherRepromptType.None, CipherSource.FillRequest],
    ["a login selection that requires none", CipherRepromptType.None, CipherSource.Login],
  ])("lets the fill of %s continue", async (_, reprompt, source) => {
    const f = fakeServices();
    const phase = confirmedReprompt(f.services);

    expect(await phase.check(selectionOf(reprompt, source), NEVER_CANCEL)).toBeUndefined();
    expect(await phase.execute(selectionOf(reprompt, source), NEVER_CANCEL)).toEqual({});
  });

  it.each([CipherSource.Login, CipherSource.Card, CipherSource.Identity])(
    "makes the fill of a %s selection that requires a reprompt invalid, with a warning",
    async (source) => {
      const f = fakeServices();

      const result = await confirmedReprompt(f.services).check(
        selectionOf(CipherRepromptType.Password, source),
        NEVER_CANCEL,
      );

      expect(result).toBe(AUTOFILL_INVALID);
      expect(f.logService.warning).toHaveBeenCalledTimes(1);
    },
  );
});
