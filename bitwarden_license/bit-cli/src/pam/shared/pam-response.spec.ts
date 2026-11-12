import { PamInputError } from "@bitwarden/bit-common/pam/shared";
import { Response } from "@bitwarden/cli/models/response";

import {
  isoDate,
  PamErrorResponse,
  pamErrorResponse,
  PamObject,
  PamResponse,
} from "./pam-response";

class ExampleResponse extends PamResponse {
  id = "x";
  constructor() {
    super(PamObject.Request);
  }
}

describe("PamResponse", () => {
  it("carries a pam- discriminator", () => {
    expect(new ExampleResponse().object).toBe("pam-request");
  });

  it("uses only pam- discriminators, spelling canceled with one L", () => {
    for (const name of Object.values(PamObject)) {
      expect(name).toMatch(/^pam-[a-z-]+$/);
    }
    expect(JSON.stringify(PamObject)).not.toContain("cancelled");
  });
});

describe("isoDate", () => {
  it("normalises a date string to ISO UTC", () => {
    expect(isoDate("2026-03-01T09:30:00+02:00")).toBe("2026-03-01T07:30:00.000Z");
  });

  it("normalises a Date", () => {
    expect(isoDate(new Date("2026-03-01T00:00:00Z"))).toBe("2026-03-01T00:00:00.000Z");
  });

  it.each([undefined, null, "garbage", new Date("x")])("answers undefined for %p", (value) => {
    expect(isoDate(value)).toBeUndefined();
  });
});

describe("pamErrorResponse", () => {
  it("fails with the decoded text and a pam-error object", () => {
    const response = pamErrorResponse(new PamInputError("Bad id."));

    expect(response.success).toBe(false);
    expect(response.message).toBe("Bad id.");
    expect(response.data).toBeInstanceOf(PamErrorResponse);
    expect(response.data).toMatchObject({ object: "pam-error", kind: "input" });
  });

  it("never prints the text of an unknown error", () => {
    const response = pamErrorResponse(new Error("token=abc123"));

    expect(response.message).toBe("The operation failed unexpectedly.");
    expect(JSON.stringify(response)).not.toContain("abc123");
  });

  it("is a failed Response", () => {
    expect(pamErrorResponse(new Error("x"))).toBeInstanceOf(Response);
  });
});
