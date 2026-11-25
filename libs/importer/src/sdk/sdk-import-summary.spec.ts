import { isEmptySdkSummary } from "./sdk-import-summary";

describe("isEmptySdkSummary", () => {
  it("is empty when nothing was imported", () => {
    expect(
      isEmptySdkSummary({ ciphers: [{ type: 1, count: 0 }], folders: 0, collections: 0 }),
    ).toBe(true);
  });

  it("is not empty with items", () => {
    expect(
      isEmptySdkSummary({ ciphers: [{ type: 1, count: 1 }], folders: 0, collections: 0 }),
    ).toBe(false);
  });

  it("is not empty with only folders", () => {
    expect(isEmptySdkSummary({ ciphers: [], folders: 1, collections: 0 })).toBe(false);
  });

  it("is not empty with only collections", () => {
    expect(isEmptySdkSummary({ ciphers: [], folders: 0, collections: 1 })).toBe(false);
  });
});
