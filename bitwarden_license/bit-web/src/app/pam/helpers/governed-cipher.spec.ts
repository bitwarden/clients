import { isGovernedCipher } from "./governed-cipher";

describe("isGovernedCipher", () => {
  it("governs a still-gated cipher", () => {
    expect(isGovernedCipher({ partial: true }, false)).toBe(true);
  });

  it("governs a full cipher revealed under a lease", () => {
    expect(isGovernedCipher({ partial: false }, true)).toBe(true);
  });

  it("does not govern a plain cipher", () => {
    expect(isGovernedCipher({ partial: false }, false)).toBe(false);
  });
});
