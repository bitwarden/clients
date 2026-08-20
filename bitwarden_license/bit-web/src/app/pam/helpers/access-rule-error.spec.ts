import { accessRuleErrorMessageKey, classifyAccessRuleError } from "./access-rule-error";

/** The SDK's flat access-rule error: a `name`-tagged Error carrying a `variant`. */
const accessRuleError = (variant: string, message = "boom") =>
  Object.assign(new Error(message), { name: "AccessRuleError", variant });

describe("classifyAccessRuleError", () => {
  const cases: ReadonlyArray<[string, string, string | undefined]> = [
    ["NameRequired", "pamAccessRuleNameRequired", "name"],
    ["NameTaken", "pamAccessRuleErrorNameTaken", "name"],
    [
      "ExtensionLengthRequired",
      "pamAccessRuleErrorExtensionLengthRequired",
      "maxExtensionDurationSeconds",
    ],
    ["CollectionsMissing", "pamAccessRuleErrorCollectionsMissing", "collections"],
    ["CollectionsForeign", "pamAccessRuleErrorCollectionsForeign", "collections"],
    ["CollectionsAlreadyGoverned", "pamAccessRuleErrorCollectionsGoverned", "collections"],
  ];

  it.each(cases)(
    "maps %s to correctable copy against its control",
    (variant, messageKey, field) => {
      expect(classifyAccessRuleError(accessRuleError(variant))).toEqual({
        kind: "mapped",
        messageKey,
        field,
      });
    },
  );

  it("maps a missing rule to its own copy, with no control to correct", () => {
    expect(classifyAccessRuleError(accessRuleError("NotFound", ""))).toEqual({
      kind: "mapped",
      messageKey: "pamAccessRuleErrorMissing",
      field: undefined,
    });
  });

  it.each([
    ["the transport variant", accessRuleError("Api")],
    ["a variant this client version does not know", accessRuleError("InventedNextYear")],
    ["a rule-shape failure the form cannot produce", accessRuleError("ConditionsRejected")],
    ["an error that is not the SDK's", new Error("boom")],
    ["a non-error", null],
  ])("falls back to generic for %s", (_label, thrown) => {
    expect(classifyAccessRuleError(thrown)).toEqual({ kind: "generic" });
  });

  it("never reads the error's message", () => {
    // The message used to be the server's whole serialized response — filesystem paths included —
    // so the classifier refused to show or log it. Reading the variant retires that hazard.
    const carrier = accessRuleError(
      "NameTaken",
      "/Users/build/server/…/AccessRuleWriteValidator.cs",
    );

    const outcome = classifyAccessRuleError(carrier);

    expect(JSON.stringify(outcome)).not.toContain("AccessRuleWriteValidator");
  });
});

describe("accessRuleErrorMessageKey", () => {
  it("returns the mapped key when there is one", () => {
    expect(accessRuleErrorMessageKey(accessRuleError("NameTaken"))).toBe(
      "pamAccessRuleErrorNameTaken",
    );
  });

  it.each([
    ["a non-SDK error", new Error("boom")],
    ["an unmapped variant", accessRuleError("Api")],
  ])("falls back to the generic key for %s", (_label, thrown) => {
    expect(accessRuleErrorMessageKey(thrown)).toBe("unexpectedError");
  });
});
