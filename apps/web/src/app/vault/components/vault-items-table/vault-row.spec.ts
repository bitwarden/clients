import { compareNames, prioritizeCollections, VaultRow } from "./vault-row";

function cipherRow(name: string): VaultRow {
  return { id: name, kind: "cipher", name };
}

function collectionRow(name: string): VaultRow {
  return { id: name, kind: "collection", name };
}

// The cross-column ordering primitives. The table's comparators compose these;
// the composition is exercised by the Storybook stories and the AOT build.
describe("vault-row sort primitives", () => {
  describe("prioritizeCollections", () => {
    it("orders collections before ciphers, regardless of name", () => {
      expect(prioritizeCollections(collectionRow("Zeta"), cipherRow("Alpha"))).toBe(-1);
      expect(prioritizeCollections(cipherRow("Alpha"), collectionRow("Zeta"))).toBe(1);
    });

    it("treats same-kind rows as equal (defers to the next comparator)", () => {
      expect(prioritizeCollections(cipherRow("a"), cipherRow("b"))).toBe(0);
      expect(prioritizeCollections(collectionRow("a"), collectionRow("b"))).toBe(0);
    });
  });

  describe("compareNames", () => {
    it("compares display names alphabetically", () => {
      expect(compareNames(cipherRow("Apple"), cipherRow("Banana"))).toBeLessThan(0);
      expect(compareNames(cipherRow("Banana"), cipherRow("Apple"))).toBeGreaterThan(0);
      expect(compareNames(cipherRow("Same"), cipherRow("Same"))).toBe(0);
    });
  });
});
