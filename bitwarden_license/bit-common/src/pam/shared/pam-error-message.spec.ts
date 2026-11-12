import { ErrorResponse } from "@bitwarden/common/models/response/error.response";

import { PAM_ERROR_CATALOG } from "./pam-error-catalog";
import {
  apiErrorBodyMessage,
  describePamError,
  pamErrorMessage,
  targetSystemCreatePendingId,
} from "./pam-error-message";
import { PamInputError } from "./pam-input-error";

function sdkError(name: string, variant: string, message: string): Error {
  return Object.assign(new Error(message), { name, variant });
}

/** The SDK's transport text for an `Api` variant: status, then the ErrorResponseModel JSON. */
function apiError(name: string, status: number, body: unknown): Error {
  return sdkError(name, "Api", `error in response: status code ${status}: ${JSON.stringify(body)}`);
}

describe("apiErrorBodyMessage", () => {
  it("decodes the message from the serialized body", () => {
    expect(apiErrorBodyMessage('prefix {"message":"Nope."} suffix')).toBe("Nope.");
  });

  it.each(["no body here", "{not json}", '{"message":""}', '{"message":5}', "} {"])(
    "answers undefined for %s",
    (text) => {
      expect(apiErrorBodyMessage(text)).toBeUndefined();
    },
  );
});

describe("describePamError", () => {
  it("passes a PamInputError through as input", () => {
    expect(describePamError(new PamInputError("Bad id."))).toEqual({
      kind: "input",
      message: "Bad id.",
    });
  });

  it.each([
    "AccessRequestError",
    "ApprovalError",
    "AccessLeaseError",
    "AccessRuleError",
    "RotationError",
  ])("decodes a catalog sentence from the Api body of %s", (name) => {
    const info = describePamError(
      apiError(name, 409, { message: PAM_ERROR_CATALOG.RequestAlreadyPending.sentence }),
    );

    expect(info).toMatchObject({
      kind: "conflict",
      message: PAM_ERROR_CATALOG.RequestAlreadyPending.sentence,
      code: "already-pending",
      variant: "Api",
      status: 409,
    });
  });

  it("classifies the licence refusal as unlicensed whatever its status", () => {
    const info = describePamError(
      apiError("AccessRequestError", 403, {
        message: `${PAM_ERROR_CATALOG.Unlicensed.sentence} Contact your administrator.`,
      }),
    );

    expect(info.kind).toBe("unlicensed");
    expect(info.message).toBe(PAM_ERROR_CATALOG.Unlicensed.sentence);
  });

  it("maps an unrecognised 403 to a clear message without echoing the server text", () => {
    const info = describePamError(
      apiError("ApprovalError", 403, { message: "Denied at /srv/app/Secret.cs line 4" }),
    );

    expect(info.kind).toBe("forbidden");
    expect(info.message).toBe("You do not have permission to do this.");
    expect(info.message).not.toContain("/srv");
  });

  it("maps an unrecognised 404 to a not-found message", () => {
    const info = describePamError(apiError("AccessLeaseError", 404, { message: "x" }));

    expect(info).toMatchObject({
      kind: "notFound",
      message: "Not found, or you do not have access to it.",
      status: 404,
    });
  });

  it.each([
    [429, "Rate limit exceeded. Try again later."],
    [500, "The server could not complete the request (status 500)."],
    [418, "The request failed (status 418)."],
  ])("words status %s without server text", (status, message) => {
    expect(
      describePamError(apiError("AccessRuleError", status, { message: "secret" })).message,
    ).toBe(message);
  });

  it("handles an Api error with no status, such as a network failure", () => {
    const info = describePamError(
      sdkError("AccessRequestError", "Api", "error in reqwest: https://host/path failed"),
    );

    expect(info.message).toBe("The request could not be completed.");
    expect(info.message).not.toContain("https");
  });

  it("extracts the interpolated maximum from an exceeds-max refusal", () => {
    const info = describePamError(
      apiError("AccessRequestError", 400, {
        message: "The requested duration exceeds the maximum of 3600 seconds.",
      }),
    );

    expect(info).toMatchObject({
      kind: "rejected",
      code: "exceeds-max-duration",
      message: "The requested duration exceeds the maximum of 3600 seconds.",
    });
  });

  it("distinguishes a window from a duration in an exceeds-max refusal", () => {
    const info = describePamError(
      sdkError(
        "AccessRequestError",
        "Validation",
        "The requested window exceeds the maximum of 60 seconds",
      ),
    );

    expect(info.code).toBe("exceeds-max-window");
  });

  it("matches the SDK's local twin of the window-in-past refusal", () => {
    const info = describePamError(
      sdkError("AccessRequestError", "Validation", "The requested window has already ended."),
    );

    expect(info).toMatchObject({ kind: "input", code: "window-in-past" });
  });

  it("shows an unknown Validation message cleaned, since the SDK words it locally", () => {
    const info = describePamError(
      sdkError("AccessRuleError", "Validation", "Bad value\u001b[31m here"),
    );

    expect(info).toMatchObject({ kind: "input", message: "Bad value[31m here" });
  });

  it.each(["NotFound", "TargetSystemNotFound"])("maps the %s variant to not found", (variant) => {
    const info = describePamError(
      sdkError("RotationError", variant, "The access rule does not exist"),
    );

    expect(info.kind).toBe("notFound");
    expect(info.message).toBe("Not found, or you do not have access to it.");
  });

  it.each(["Decode", "VaultParse", "Crypto", "Sealed", "InvalidConditions", "Chrono"])(
    "reports only the name and variant for the %s variant, never its message",
    (variant) => {
      const info = describePamError(
        sdkError("AccessLeaseError", variant, "payload: hunter2 sealed-field"),
      );

      expect(info.kind).toBe("unexpected");
      expect(info.message).toBe(
        `The Privileged Controls operation failed (AccessLeaseError: ${variant}).`,
      );
      expect(info.message).not.toContain("hunter2");
    },
  );

  it("decodes an ErrorResponse from the API service", () => {
    const response = new ErrorResponse({ Message: PAM_ERROR_CATALOG.RuleNameTaken.sentence }, 409);

    expect(describePamError(response)).toMatchObject({
      kind: "conflict",
      code: "name-taken",
      status: 409,
      variant: "ErrorResponse",
    });
  });

  it("answers a forbidden ErrorResponse with no recognisable text", () => {
    expect(describePamError(new ErrorResponse({ Message: "nope" }, 403)).kind).toBe("forbidden");
  });

  it("decodes a TargetSystemCreateError, a plain object with a message", () => {
    const info = describePamError({
      id: "abc",
      message: "Account identity must be between 1 and 500 characters",
    });

    expect(info).toMatchObject({ kind: "rejected", code: "invalid-account-identity" });
  });

  it("falls back to a generic message for anything else", () => {
    expect(describePamError(new Error("boom: token=abc")).message).toBe(
      "The operation failed unexpectedly.",
    );
    expect(describePamError("a string").message).toBe("The operation failed unexpectedly.");
    expect(describePamError(undefined).kind).toBe("unexpected");
  });

  it("ignores an Error that only looks like an SDK error by name", () => {
    expect(describePamError(new Error("x")).kind).toBe("unexpected");
    expect(
      describePamError(Object.assign(new Error("x"), { name: "AccessRequestError" })).kind,
    ).toBe("unexpected");
  });
});

describe("pamErrorMessage", () => {
  it("is the message of describePamError", () => {
    expect(pamErrorMessage(new PamInputError("Bad."))).toBe("Bad.");
  });
});

describe("targetSystemCreatePendingId", () => {
  it("answers the pending id of a partial create failure", () => {
    expect(targetSystemCreatePendingId({ id: "ts-1", message: "failed" })).toBe("ts-1");
  });

  it("answers undefined when nothing was created", () => {
    expect(targetSystemCreatePendingId({ id: undefined, message: "failed" })).toBeUndefined();
  });

  it("answers undefined for an Error, which is not that shape", () => {
    expect(targetSystemCreatePendingId(new Error("x"))).toBeUndefined();
  });
});
