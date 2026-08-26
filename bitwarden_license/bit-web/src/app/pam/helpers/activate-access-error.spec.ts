import {
  ACTIVATE_ACCESS_SERVER_ERRORS,
  activateAccessErrorMessageKey,
} from "./activate-access-error";

/** The SDK's activation error: a `name`-tagged Error carrying a `variant`. */
const activationError = (variant: string, message: string) =>
  Object.assign(new Error(message), { name: "AccessRequestError", variant });

/** The sentence buried in the serialized response, apostrophes escaped as `\u0027`. */
const wireBody = (serverMessage: string) => {
  const encoded = serverMessage.replace(/'/g, "\\u0027");
  return (
    `error in response: status code 409 Conflict: {"object":"error","message":"${encoded}",` +
    `"validationErrors":null,"exceptionMessage":"${encoded}","exceptionStackTrace":"   at ` +
    "Bit.Services.Pam.OrganizationFeatures.Commands.ActivateAccessRequestCommand.ActivateAsync" +
    "(Guid userId, Guid requestId) in /src/bitwarden_license/src/Services/Pam/" +
    'OrganizationFeatures/Commands/ActivateAccessRequestCommand.cs:line 65"}'
  );
};

describe("activateAccessErrorMessageKey", () => {
  const cases = Object.values(ACTIVATE_ACCESS_SERVER_ERRORS).map(
    (entry) => [entry.serverMessage, entry.messageKey] as const,
  );

  it.each(cases)(
    "maps %p out of the serialized response body onto its own copy",
    (serverMessage, messageKey) => {
      expect(activateAccessErrorMessageKey(activationError("Api", wireBody(serverMessage)))).toBe(
        messageKey,
      );
    },
  );

  it.each([
    [
      "an unrecognised server message",
      activationError("Api", wireBody("Something else entirely.")),
    ],
    ["an error that isn't the SDK's shape", new Error("offline")],
    ["an empty message", activationError("Api", "")],
    ["a non-error", "not an error"],
    ["nothing at all", undefined],
  ])("falls back to the generic key for %s", (_name, thrown) => {
    expect(activateAccessErrorMessageKey(thrown)).toBe("pamStartLeaseError");
  });
});
