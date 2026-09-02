// `libs/common` re-exports this barrel from its enum index, so it is loaded by specs across the
// monorepo that stub `@bitwarden/sdk-internal` with only the members they use.
jest.mock("@bitwarden/sdk-internal", () => ({}));

describe("@bitwarden/logging", () => {
  it("loads without reading anything off the SDK", async () => {
    await expect(import("./index")).resolves.toBeDefined();
  });
});
