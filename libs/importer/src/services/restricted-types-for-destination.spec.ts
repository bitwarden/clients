import { CipherType } from "@bitwarden/common/vault/enums";
import { RestrictedCipherType } from "@bitwarden/common/vault/services/restricted-item-types.service";

import { restrictedTypesForDestination } from "./restricted-types-for-destination";

describe("restrictedTypesForDestination", () => {
  // Acme removes cards and passports; Beta allows both; Gamma removes only identities.
  const restricted: RestrictedCipherType[] = [
    { cipherType: CipherType.Card, allowViewOrgIds: ["beta", "gamma"] },
    { cipherType: CipherType.Passport, allowViewOrgIds: ["beta", "gamma"] },
    { cipherType: CipherType.Identity, allowViewOrgIds: ["acme", "beta"] },
  ];

  it("removes every restricted type for My vault", () => {
    expect(restrictedTypesForDestination(restricted)).toEqual([
      CipherType.Card,
      CipherType.Passport,
      CipherType.Identity,
    ]);
    expect(restrictedTypesForDestination(restricted, null)).toHaveLength(3);
  });

  it("removes the types an organization does not allow", () => {
    expect(restrictedTypesForDestination(restricted, "acme")).toEqual([
      CipherType.Card,
      CipherType.Passport,
    ]);
  });

  it("removes only that organization's own restrictions", () => {
    expect(restrictedTypesForDestination(restricted, "gamma")).toEqual([CipherType.Identity]);
  });

  it("removes nothing for an organization that allows every restricted type", () => {
    expect(restrictedTypesForDestination(restricted, "beta")).toEqual([]);
  });

  it("removes nothing when nothing is restricted", () => {
    expect(restrictedTypesForDestination([])).toEqual([]);
    expect(restrictedTypesForDestination([], "acme")).toEqual([]);
  });
});
