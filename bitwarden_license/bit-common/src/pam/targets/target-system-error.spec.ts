import { describeTargetSystemError } from "./target-system-error";

function apiError(status: number, message: string): Error {
  const e = new Error(
    `error in response: status code ${status}: ${JSON.stringify({ message, extra: "/srv/secret/path" })}`,
  );
  e.name = "RotationError";
  (e as Error & { variant: string }).variant = "Api";
  return e;
}

describe("describeTargetSystemError", () => {
  it("maps the delete refusal while rotation configs name the target", () => {
    const info = describeTargetSystemError(
      apiError(
        400,
        "This target system still has rotation configs. Delete them before deleting the target system.",
      ),
    );

    expect(info.code).toBe("target-system-has-rotation-configs");
    expect(info.message).toContain("rotation configs");
    expect(info.message).toContain("bw privileged-controls target disable");
    expect(info.message).not.toContain("/srv");
  });

  it("maps the unsealed enable and disable refusal", () => {
    const info = describeTargetSystemError(
      apiError(
        400,
        "This target system has not been sealed yet and cannot be enabled or disabled.",
      ),
    );

    expect(info.code).toBe("target-system-not-sealed");
  });

  it("maps the method and kind refusals through the shared catalog", () => {
    expect(
      describeTargetSystemError(apiError(400, "Target system method cannot be changed")).code,
    ).toBe("target-system-method-immutable");
    expect(
      describeTargetSystemError(apiError(400, "Target system kind cannot be changed")).code,
    ).toBe("target-system-kind-immutable");
  });

  it("drops unrecognised server text", () => {
    const info = describeTargetSystemError(apiError(400, "boom at /srv/app/File.cs:12"));

    expect(info.message).not.toContain("/srv");
    expect(info.status).toBe(400);
  });

  it("falls back to a non-Error value", () => {
    expect(describeTargetSystemError("nope").kind).toBe("unexpected");
  });
});
