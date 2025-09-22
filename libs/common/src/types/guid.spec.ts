import { isId, emptyGuid, OrganizationId } from "./guid";

describe("isId tests", () => {
  it("should return true for a valid guid string", () => {
    // Example valid GUID
    const validGuid = "12345678-1234-1234-1234-123456789abc";
    expect(isId(validGuid)).toBe(true);
  });

  it("should return false for an invalid guid string", () => {
    // Example invalid GUID
    const invalidGuid = "not-a-guid";
    expect(isId(invalidGuid)).toBe(false);
  });

  it("should return false for non-string values", () => {
    expect(isId(undefined)).toBe(false);
    expect(isId(null)).toBe(false);
    expect(isId(123)).toBe(false);
    expect(isId({})).toBe(false);
    expect(isId([])).toBe(false);
  });

  it("should return true for the emptyGuid constant if it is a valid guid", () => {
    expect(isId(emptyGuid)).toBe(true);
  });

  it("should infer type OrganizationId when using isId<OrganizationId>", () => {
    const orgId: string = "12345678-1234-1234-1234-123456789abc";
    if (isId<OrganizationId>(orgId)) {
      return;
    }
    throw new Error("Type guard failed, orgId is not a valid OrganizationId");
  });
});
