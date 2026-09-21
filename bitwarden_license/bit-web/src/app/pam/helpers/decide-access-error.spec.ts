import {
  DECIDE_ACCESS_SERVER_ERRORS,
  decideAccessErrorMessageKey,
  isRequestNoLongerPendingError,
} from "./decide-access-error";

/** The SDK's decide error: a `name`-tagged Error carrying a `variant`. */
const approvalError = (variant: string, message: string) =>
  Object.assign(new Error(message), { name: "ApprovalError", variant });

/** The sentence buried in the serialized response, apostrophes escaped as `'`. */
const wireBody = (serverMessage: string) => {
  const encoded = serverMessage.replace(/'/g, "\\u0027");
  return (
    `error in response: status code 409 Conflict: {"object":"error","message":"${encoded}",` +
    `"validationErrors":null,"exceptionMessage":"${encoded}","exceptionStackTrace":"   at ` +
    "Bit.Services.Pam.OrganizationFeatures.Commands.DecideAccessRequestCommand.DecideAsync" +
    "(Guid userId, Guid requestId, AccessDecisionSubmission submission) in /src/bitwarden_license/" +
    'src/Services/Pam/OrganizationFeatures/Commands/DecideAccessRequestCommand.cs:line 58"}'
  );
};

/**
 * Pinned against the sentences `DecideAccessRequestCommand` throws, spelled out here rather than
 * read off the catalog, so a server-side rewording fails this test instead of silently degrading
 * the approver's copy to generic.
 */
describe("DECIDE_ACCESS_SERVER_ERRORS", () => {
  it("carries the server's sentences verbatim", () => {
    expect(DECIDE_ACCESS_SERVER_ERRORS.AlreadyResolved.serverMessage).toBe(
      "This request has already been resolved.",
    );
    expect(DECIDE_ACCESS_SERVER_ERRORS.WindowEnded.serverMessage).toBe(
      "This request's window has already ended.",
    );
  });
});

describe("decideAccessErrorMessageKey", () => {
  const cases = Object.values(DECIDE_ACCESS_SERVER_ERRORS).map(
    (entry) => [entry.serverMessage, entry.messageKey] as const,
  );

  it.each(cases)(
    "maps %p out of the serialized response body onto its own copy",
    (serverMessage, messageKey) => {
      expect(decideAccessErrorMessageKey(approvalError("Api", wireBody(serverMessage)))).toBe(
        messageKey,
      );
    },
  );

  it("falls back to the raw message when there is no JSON body to decode", () => {
    expect(
      decideAccessErrorMessageKey(
        approvalError("Api", DECIDE_ACCESS_SERVER_ERRORS.AlreadyResolved.serverMessage),
      ),
    ).toBe(DECIDE_ACCESS_SERVER_ERRORS.AlreadyResolved.messageKey);
  });

  it.each([
    ["an unrecognised server message", approvalError("Api", wireBody("Something else entirely."))],
    [
      "a refusal the surfaces prevent",
      approvalError("Api", wireBody("You cannot decide your own request.")),
    ],
    ["an error that isn't the SDK's shape", new Error("offline")],
    ["an empty message", approvalError("Api", "")],
    ["a non-error", "not an error"],
    ["nothing at all", undefined],
  ])("falls back to the generic key for %s", (_name, thrown) => {
    expect(decideAccessErrorMessageKey(thrown)).toBe("pamInboxDecisionFailed");
  });
});

describe("isRequestNoLongerPendingError", () => {
  it.each(
    Object.values(DECIDE_ACCESS_SERVER_ERRORS).map((entry) => [entry.serverMessage] as const),
  )("recognises %p as the request having left the pending set", (serverMessage) => {
    expect(isRequestNoLongerPendingError(approvalError("Api", wireBody(serverMessage)))).toBe(true);
  });

  it.each([
    ["a transport failure", new Error("offline")],
    [
      "a refusal that leaves the request pending",
      approvalError("Api", wireBody("A reason is required when denying a request.")),
    ],
    ["a non-error", "not an error"],
    ["nothing at all", undefined],
  ])("does not recognise %s", (_name, thrown) => {
    expect(isRequestNoLongerPendingError(thrown)).toBe(false);
  });
});
