import * as lib from "./index";

describe("serialization", () => {
  // This test will fail until something is exported from index.ts
  it("should work", () => {
    expect(lib).toBeDefined();
  });
});
