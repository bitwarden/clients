import { readFileSync } from "fs";

import {
  ACCESS_RULE_SERVER_ERRORS,
  accessRuleErrorMessageKey,
  classifyAccessRuleError,
} from "./access-rule-error";
import { ACCESS_RULE_NAME_MAX_LENGTH } from "./access-rule-request";

/** The SDK's flat access-rule error: a `name`-tagged Error carrying a `variant`. */
const accessRuleError = (variant: string, message: string) =>
  Object.assign(new Error(message), { name: "AccessRuleError", variant });

/** How the wire body actually reaches `.message`: the sentence buried in the serialized response. */
const wireBody = (serverMessage: string) =>
  `error in response: status code 400 Bad Request: {"object":"error","message":"${serverMessage}",` +
  `"validationErrors":null,"exceptionMessage":"${serverMessage}","exceptionStackTrace":" at ` +
  "Bit.Services.Pam.Services.AccessRuleWriteValidator.ValidateAsync(Guid organizationId) in " +
  '/Users/build/server/bitwarden_license/src/Services/Pam/Services/AccessRuleWriteValidator.cs:line 87"}';

describe("classifyAccessRuleError", () => {
  const cases: ReadonlyArray<[string, string, string | undefined]> = [
    [ACCESS_RULE_SERVER_ERRORS.NameRequired.serverMessage, "pamAccessRuleNameRequired", "name"],
    [ACCESS_RULE_SERVER_ERRORS.NameTaken.serverMessage, "pamAccessRuleErrorNameTaken", "name"],
    [
      ACCESS_RULE_SERVER_ERRORS.ExtensionLengthRequired.serverMessage,
      "pamAccessRuleErrorExtensionLengthRequired",
      "maxExtensionDurationSeconds",
    ],
    [
      ACCESS_RULE_SERVER_ERRORS.CollectionsMissing.serverMessage,
      "pamAccessRuleErrorCollectionsMissing",
      "collections",
    ],
    [
      ACCESS_RULE_SERVER_ERRORS.CollectionsForeign.serverMessage,
      "pamAccessRuleErrorCollectionsForeign",
      "collections",
    ],
    [
      ACCESS_RULE_SERVER_ERRORS.CollectionsGoverned.serverMessage,
      "pamAccessRuleErrorCollectionsGoverned",
      "collections",
    ],
  ];

  it.each(cases)(
    "maps %p out of the serialized response body onto its own copy",
    (serverMessage, messageKey, field) => {
      const outcome = classifyAccessRuleError(accessRuleError("Api", wireBody(serverMessage)));

      expect(outcome).toEqual({ kind: "mapped", messageKey, field });
    },
  );

  it("maps the NotFound variant onto the rule-is-gone copy, with no field to blame", () => {
    const outcome = classifyAccessRuleError(accessRuleError("NotFound", ""));

    expect(outcome).toEqual({ kind: "mapped", messageKey: "pamAccessRuleErrorMissing" });
  });

  it("maps the SDK's own local blank-name rejection onto the name field, not the generic banner", () => {
    const outcome = classifyAccessRuleError(
      accessRuleError("Validation", ACCESS_RULE_SERVER_ERRORS.NameRequiredLocally.serverMessage),
    );

    expect(outcome).toEqual({
      kind: "mapped",
      messageKey: "pamAccessRuleNameRequired",
      field: "name",
    });
  });

  it("falls back to generic for a conditions-document failure the admin cannot act on", () => {
    const outcome = classifyAccessRuleError(
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
    expect(classifyAccessRuleError(thrown)).toEqual({ kind: "generic" });
  });

  it("never returns the server's own words, whatever it was handed", () => {
    const outcomes = [
      ...cases.map(([serverMessage]) =>
        classifyAccessRuleError(accessRuleError("Api", wireBody(serverMessage))),
      ),
      classifyAccessRuleError(accessRuleError("Api", wireBody("Something else entirely."))),
    ];

    for (const outcome of outcomes) {
      const serialized = JSON.stringify(outcome);
      expect(serialized).not.toContain("exceptionStackTrace");
      expect(serialized).not.toContain("status code 400");
      expect(serialized).not.toContain(".cs:line");
    }
  });
});

describe("accessRuleErrorMessageKey", () => {
  it("returns the mapped copy's key", () => {
    expect(
      accessRuleErrorMessageKey(
        accessRuleError("Api", wireBody(ACCESS_RULE_SERVER_ERRORS.NameTaken.serverMessage)),
      ),
    ).toBe("pamAccessRuleErrorNameTaken");
  });

  it("returns the generic key for anything unrecognised", () => {
    expect(accessRuleErrorMessageKey(new Error("boom"))).toBe("unexpectedError");
    expect(accessRuleErrorMessageKey(accessRuleError("Api", wireBody("Something else.")))).toBe(
      "unexpectedError",
    );
  });
});

/**
 * The SDK builds this sentence itself, before any request goes out, and offers no code to switch
 * on, so the mapping onto the Name field survives only while the catalog repeats it verbatim. The
 * first expectation spells the sentence out rather than reading it back from the catalog or
 * rebuilding it from ACCESS_RULE_NAME_MAX_LENGTH — either would pass against a reword the catalog
 * had absorbed — but on its own it can only catch an edit to the catalog, so the rest hold it to
 * the SDK. The wasm never spells the sentence out whole: it stores the literal pieces either side
 * of the maximum and formats the number in at runtime, which is why the number is pinned to
 * ACCESS_RULE_NAME_MAX_LENGTH while the pieces are matched against the binary.
 */
describe("ACCESS_RULE_SERVER_ERRORS.NameRequiredLocally", () => {
  const { serverMessage } = ACCESS_RULE_SERVER_ERRORS.NameRequiredLocally;
  const wasm = readFileSync(
    require.resolve("@bitwarden/commercial-sdk-internal/bitwarden_wasm_internal_bg.wasm"),
  );

  it("still holds the wording last verified against the SDK", () => {
    expect(serverMessage).toBe("Name must be between 1 and 256 characters");
  });

  it("names the maximum a name is held to before it is sent", () => {
    expect(serverMessage).toContain(String(ACCESS_RULE_NAME_MAX_LENGTH));
  });

  it.each(serverMessage.split(String(ACCESS_RULE_NAME_MAX_LENGTH)))(
    "is still built from %p in the SDK's wasm",
    (piece) => {
      expect(wasm.includes(Buffer.from(piece, "utf8"))).toBe(true);
    },
  );
});
