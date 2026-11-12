import { PamInputError } from "../shared/pam-input-error";

import {
  parseTargetSystemJson,
  targetSystemTemplate,
  validateTargetSystemRequest,
} from "./target-system-request";

const policy = {
  minLength: 16,
  maxLength: 32,
  includeUppercase: true,
  includeLowercase: true,
  includeDigits: true,
  includeSymbols: false,
};

describe("parseTargetSystemJson", () => {
  it.each(["", "  ", "{not json", "[]", "null", "42"])("refuses %p", (text) => {
    expect(() => parseTargetSystemJson(text)).toThrow(PamInputError);
  });

  it("does not echo the text in a refusal", () => {
    expect.assertions(1);
    try {
      parseTargetSystemJson("{SECRET-POLICY");
    } catch (e) {
      expect((e as Error).message).not.toContain("SECRET");
    }
  });

  it("refuses text over the length cap", () => {
    expect(() => parseTargetSystemJson(`{"a":"${"x".repeat(70_000)}"}`)).toThrow(/longer than/);
  });

  it("returns the object", () => {
    expect(parseTargetSystemJson(' {"name":"a"} ')).toEqual({ name: "a" });
  });
});

describe("validateTargetSystemRequest", () => {
  it("accepts an automatic request", () => {
    const request = validateTargetSystemRequest({
      method: "automatic",
      name: " Entra ",
      kind: "entra",
      passwordPolicy: policy,
      supportsSessionTermination: true,
    });

    expect(request).toEqual({
      method: "automatic",
      name: "Entra",
      kind: "entra",
      passwordPolicy: policy,
      supportsSessionTermination: true,
    });
  });

  it("accepts a manual request", () => {
    expect(
      validateTargetSystemRequest({ method: "manual", name: "Vendor", passwordPolicy: policy }),
    ).toEqual({ method: "manual", name: "Vendor", passwordPolicy: policy });
  });

  it("fills name and method from the fallback", () => {
    expect(
      validateTargetSystemRequest(
        { passwordPolicy: policy },
        { name: "Existing", method: "manual" },
      ),
    ).toEqual({ method: "manual", name: "Existing", passwordPolicy: policy });
  });

  it("does not fill sealed fields from anywhere", () => {
    expect(() =>
      validateTargetSystemRequest({ method: "manual", name: "x" }, { name: "x" }),
    ).toThrow(/passwordPolicy/);
  });

  it.each([
    ["the Active Directory kind", { kind: "active_directory" }],
    ["an unknown kind", { kind: "other" }],
    ["a missing kind", { kind: undefined }],
    ["a missing session termination flag", { supportsSessionTermination: undefined }],
    ["a string session termination flag", { supportsSessionTermination: "yes" }],
    ["an unknown key", { extra: 1 }],
    ["an unknown method", { method: "hybrid" }],
    ["a blank name", { name: "  " }],
    ["a name over 200 characters", { name: "n".repeat(201) }],
  ])("refuses %s", (_label, override) => {
    const base = {
      method: "automatic",
      name: "x",
      kind: "entra",
      passwordPolicy: policy,
      supportsSessionTermination: false,
    };
    expect(() => validateTargetSystemRequest({ ...base, ...override })).toThrow(PamInputError);
  });

  it("refuses a manual request that names a kind", () => {
    expect(() =>
      validateTargetSystemRequest({
        method: "manual",
        name: "x",
        kind: "entra",
        passwordPolicy: policy,
      }),
    ).toThrow(/does not take "kind"/);
  });

  it.each([
    ["min above max", { minLength: 40 }],
    ["a fractional length", { maxLength: 20.5 }],
    ["a zero length", { minLength: 0 }],
    ["a non-boolean class", { includeDigits: "true" }],
    ["a missing class", { includeSymbols: undefined }],
    ["an unknown key", { entropy: 90 }],
  ])("refuses a password policy with %s", (_label, override) => {
    expect(() =>
      validateTargetSystemRequest({
        method: "manual",
        name: "x",
        passwordPolicy: { ...policy, ...override },
      }),
    ).toThrow(PamInputError);
  });

  it("refuses a missing password policy", () => {
    expect(() => validateTargetSystemRequest({ method: "manual", name: "x" })).toThrow(
      /passwordPolicy/,
    );
  });

  it("ignores the object discriminator of a printed template", () => {
    expect(
      validateTargetSystemRequest({
        object: "pam-target-system-template",
        method: "manual",
        name: "x",
        passwordPolicy: policy,
      }),
    ).toEqual({ method: "manual", name: "x", passwordPolicy: policy });
  });

  it("accepts its own templates", () => {
    expect(() =>
      validateTargetSystemRequest(
        targetSystemTemplate("automatic") as unknown as Record<string, unknown>,
      ),
    ).not.toThrow();
    expect(() =>
      validateTargetSystemRequest(
        targetSystemTemplate("manual") as unknown as Record<string, unknown>,
      ),
    ).not.toThrow();
  });
});
