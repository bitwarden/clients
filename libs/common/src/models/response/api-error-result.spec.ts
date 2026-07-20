import { mapApiErrorToResult } from "./api-error-result";
import { ErrorResponse } from "./error.response";

type Kind = "not-available" | "not-found" | "unauthorized" | "unexpected";

const map = {
  validationErrorTypes: { server_type_code: "not-available" } as Record<string, Kind>,
  unauthorized: "unauthorized" as Kind,
  notFound: "not-found" as Kind,
  unexpected: "unexpected" as Kind,
};

function validationProblem(type: string, detail: string, property = "code"): ErrorResponse {
  return new ErrorResponse({ errors: { [property]: [{ type, detail }] } }, 400);
}

describe("mapApiErrorToResult", () => {
  it("maps a non-ErrorResponse throwable to unexpected", () => {
    expect(mapApiErrorToResult(new Error("network down"), map)).toEqual({
      kind: "unexpected",
      cause: "Error: network down",
    });
  });

  it.each([401, 403])("maps a %s to unauthorized", (status) => {
    const error = new ErrorResponse({ Message: "Access denied." }, status);

    expect(mapApiErrorToResult(error, map)).toEqual({
      kind: "unauthorized",
      cause: "Access denied.",
    });
  });

  it("maps a 404 to notFound", () => {
    const error = new ErrorResponse({ Message: "Not found." }, 404);

    expect(mapApiErrorToResult(error, map)).toEqual({ kind: "not-found", cause: "Not found." });
  });

  it("falls back to unexpected on 404 when notFound is not provided", () => {
    const error = new ErrorResponse({ Message: "Not found." }, 404);

    expect(
      mapApiErrorToResult(error, {
        unauthorized: "unauthorized" as Kind,
        unexpected: "unexpected" as Kind,
      }),
    ).toEqual({
      kind: "unexpected",
      cause: "Not found.",
    });
  });

  it("maps a recognized 400 validation type to its kind with the problem detail as cause", () => {
    expect(mapApiErrorToResult(validationProblem("server_type_code", "boom"), map)).toEqual({
      kind: "not-available",
      cause: "boom",
    });
  });

  it("returns the first recognized problem when several are present", () => {
    const error = new ErrorResponse(
      {
        errors: {
          other: [{ type: "unknown_code", detail: "ignored" }],
          code: [{ type: "server_type_code", detail: "boom" }],
        },
      },
      400,
    );

    expect(mapApiErrorToResult(error, map)).toEqual({ kind: "not-available", cause: "boom" });
  });

  it("falls back to the first problem detail for an unrecognized 400 type", () => {
    expect(mapApiErrorToResult(validationProblem("unknown_code", "boom"), map)).toEqual({
      kind: "unexpected",
      cause: "boom",
    });
  });

  it("maps other status codes to unexpected", () => {
    const error = new ErrorResponse({ Message: "Server error." }, 500);

    expect(mapApiErrorToResult(error, map)).toEqual({ kind: "unexpected", cause: "Server error." });
  });
});
