import { isGovernedCipher } from "./governed-cipher";

describe("isGovernedCipher", () => {
  it("governs a still-gated cipher", () => {
    expect(isGovernedCipher({ partial: true })).toBe(true);
  });

  it("governs a full cipher revealed under a lease", () => {
    expect(isGovernedCipher({ partial: false, leaseGated: true })).toBe(true);
  });

  it("does not govern a plain cipher", () => {
    expect(isGovernedCipher({ partial: false })).toBe(false);
    expect(isGovernedCipher({ partial: false, leaseGated: false })).toBe(false);
  });
});
