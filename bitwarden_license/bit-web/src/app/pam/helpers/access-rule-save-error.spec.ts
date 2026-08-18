import {
  ACCESS_RULE_WRITE_SERVER_ERRORS,
  classifyAccessRuleSaveError,
} from "./access-rule-save-error";

/** The SDK's flat access-rule error: a `name`-tagged Error carrying a `variant`. */
const accessRuleError = (variant: string, message: string) =>
  Object.assign(new Error(message), { name: "AccessRuleError", variant });

/** How the wire body actually reaches `.message`: the sentence buried in the serialized response. */
const wireBody = (serverMessage: string) =>
  `error in response: status code 400 Bad Request: {"object":"error","message":"${serverMessage}",` +
  `"validationErrors":null,"exceptionMessage":"${serverMessage}","exceptionStackTrace":" at ` +
  "Bit.Services.Pam.Services.AccessRuleWriteValidator.ValidateAsync(Guid organizationId) in " +
  '/Users/build/server/bitwarden_license/src/Services/Pam/Services/AccessRuleWriteValidator.cs:line 87"}';

describe("classifyAccessRuleSaveError", () => {
  const cases: ReadonlyArray<[string, string, string | undefined]> = [
    [ACCESS_RULE_WRITE_SERVER_ERRORS.NameRequired, "pamAccessRuleNameRequired", "name"],
    [ACCESS_RULE_WRITE_SERVER_ERRORS.NameTaken, "pamAccessRuleErrorNameTaken", "name"],
    [
      ACCESS_RULE_WRITE_SERVER_ERRORS.ExtensionLengthRequired,
      "pamAccessRuleErrorExtensionLengthRequired",
      "maxExtensionDurationSeconds",
    ],
    [
      ACCESS_RULE_WRITE_SERVER_ERRORS.CollectionsMissing,
      "pamAccessRuleErrorCollectionsMissing",
      "collections",
    ],
    [
      ACCESS_RULE_WRITE_SERVER_ERRORS.CollectionsForeign,
      "pamAccessRuleErrorCollectionsForeign",
      "collections",
    ],
    [
      ACCESS_RULE_WRITE_SERVER_ERRORS.CollectionsGoverned,
      "pamAccessRuleErrorCollectionsGoverned",
      "collections",
    ],
  ];

  it.each(cases)(
    "maps %p out of the serialized response body onto its own copy",
    (serverMessage, messageKey, field) => {
      const outcome = classifyAccessRuleSaveError(accessRuleError("Api", wireBody(serverMessage)));

      expect(outcome).toEqual({ kind: "mapped", messageKey, field });
    },
  );

  it("maps the NotFound variant onto the rule-is-gone copy, with no field to blame", () => {
    const outcome = classifyAccessRuleSaveError(accessRuleError("NotFound", ""));

    expect(outcome).toEqual({ kind: "mapped", messageKey: "pamAccessRuleErrorMissing" });
  });

  it("falls back to generic for a conditions-document failure the admin cannot act on", () => {
    const outcome = classifyAccessRuleSaveError(
      accessRuleError("Validation", "Conditions must be an array."),
    );

    expect(outcome).toEqual({ kind: "generic" });
  });

  it.each([
    ["an unrecognised server message", accessRuleError("Api", "Something else entirely.")],
    ["an error that isn't the SDK's shape", new Error("boom")],
    ["an empty message", accessRuleError("Api", "")],
    ["a non-error", "not an error"],
    ["nothing at all", undefined],
  ])("falls back to generic for %s", (_name, thrown) => {
    expect(classifyAccessRuleSaveError(thrown)).toEqual({ kind: "generic" });
  });

  it("never returns the server's own words, whatever it was handed", () => {
    const outcomes = [
      ...cases.map(([serverMessage]) =>
        classifyAccessRuleSaveError(accessRuleError("Api", wireBody(serverMessage))),
      ),
      classifyAccessRuleSaveError(accessRuleError("Api", wireBody("Something else entirely."))),
    ];

    for (const outcome of outcomes) {
      const serialized = JSON.stringify(outcome);
      expect(serialized).not.toContain("exceptionStackTrace");
      expect(serialized).not.toContain("status code 400");
      expect(serialized).not.toContain(".cs:line");
    }
  });
});
