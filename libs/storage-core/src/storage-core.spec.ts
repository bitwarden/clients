import * as lib from "./index";

describe("storage-core", () => {
  // This test will fail until something is exported from index.ts
  it("should work", () => {
    expect(lib).toBeDefined();
  });
});
