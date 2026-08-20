import type { AccessRuleError, AccessRuleErrorVariant } from "./access-rule";
import { accessRuleErrorVariant, isAccessRuleNotFound } from "./access-rule";

function accessRuleError(variant: AccessRuleErrorVariant, message = "boom"): AccessRuleError {
  const error = new Error(message) as AccessRuleError;
  error.name = "AccessRuleError";
  (error as { variant: AccessRuleErrorVariant }).variant = variant;
  return error;
}

describe("accessRuleErrorVariant", () => {
  it.each<AccessRuleErrorVariant>(["Validation", "NotFound", "NameTaken", "Api"])(
    "returns the SDK's %s variant",
    (variant) => {
      expect(accessRuleErrorVariant(accessRuleError(variant))).toBe(variant);
    },
  );

  it("returns undefined for an error that is not the SDK's", () => {
    expect(accessRuleErrorVariant(new Error("network down"))).toBeUndefined();
  });

  it("returns undefined for a shape that only looks like one", () => {
    // Structural, not `instanceof`: a plain object carrying the right fields is still not an Error.
    expect(
      accessRuleErrorVariant({ name: "AccessRuleError", variant: "NotFound", message: "x" }),
    ).toBeUndefined();
  });

  it.each([null, undefined, "nope"])("returns undefined for %p", (thrown) => {
    expect(accessRuleErrorVariant(thrown)).toBeUndefined();
  });
});

describe("isAccessRuleNotFound", () => {
  it("is true for the NotFound variant", () => {
    expect(isAccessRuleNotFound(accessRuleError("NotFound"))).toBe(true);
  });

  it.each<AccessRuleErrorVariant>(["Validation", "Api", "NameTaken"])(
    "is false for the %s variant",
    (variant) => {
      expect(isAccessRuleNotFound(accessRuleError(variant))).toBe(false);
    },
  );

  it("is false for an error that merely mentions it", () => {
    expect(isAccessRuleNotFound(new Error("NotFound"))).toBe(false);
  });

  it.each([null, undefined])("is false for %p", (thrown) => {
    expect(isAccessRuleNotFound(thrown)).toBe(false);
  });
});
