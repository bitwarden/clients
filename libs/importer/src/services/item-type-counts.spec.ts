import { CipherType } from "@bitwarden/common/vault/enums";

import { countAfterRemoval, countCipherTypes } from "./item-type-counts";

describe("countCipherTypes", () => {
  it("counts items per type", () => {
    const ciphers = [
      { type: CipherType.Login },
      { type: CipherType.Card },
      { type: CipherType.Login },
    ];

    expect(countCipherTypes(ciphers)).toEqual({ [CipherType.Login]: 2, [CipherType.Card]: 1 });
  });

  it("returns no counts for no items", () => {
    expect(countCipherTypes([])).toEqual({});
  });
});

describe("countAfterRemoval", () => {
  const counts = { [CipherType.Login]: 2, [CipherType.Card]: 3, [CipherType.Passport]: 1 };

  it("totals everything when nothing is removed", () => {
    expect(countAfterRemoval(counts, [])).toBe(6);
  });

  it("leaves out the removed types", () => {
    expect(countAfterRemoval(counts, [CipherType.Card, CipherType.Passport])).toBe(2);
  });

  it("ignores a removed type that has no items", () => {
    expect(countAfterRemoval(counts, [CipherType.SshKey])).toBe(6);
  });

  it("is zero when every present type is removed", () => {
    expect(
      countAfterRemoval(counts, [CipherType.Login, CipherType.Card, CipherType.Passport]),
    ).toBe(0);
  });
});
