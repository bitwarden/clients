import type { AccessRuleError, AccessRuleErrorVariant } from "./access-rule";
import {
  accessRuleErrorMessage,
  isAccessRuleCollectionConflict,
  isAccessRuleNotFound,
  isHumanApproval,
  isIpAllowlist,
  isKnownAccessCondition,
} from "./access-rule";

function accessRuleError(variant: AccessRuleErrorVariant, message = "boom"): AccessRuleError {
  const error = new Error(message) as unknown as AccessRuleError;
  (error as { name: string }).name = "AccessRuleError";
  (error as { variant: AccessRuleErrorVariant }).variant = variant;
  return error;
}

describe("accessRuleErrorMessage", () => {
  it("returns the message for the SDK's flat AccessRuleError shape", () => {
    expect(accessRuleErrorMessage(accessRuleError("Validation", "Name is required"))).toBe(
      "Name is required",
    );
  });

  it.each<AccessRuleErrorVariant>([
    "NotFound",
    "Validation",
    "InvalidConditions",
    "MissingField",
    "Chrono",
  ])("recognises the %s variant", (variant) => {
    expect(accessRuleErrorMessage(accessRuleError(variant))).toBe("boom");
  });

  // The Api variant wraps the whole failed HTTP response; only the server's inner
  // `message` field is toastable.
  describe("the Api variant", () => {
    const wrap = (body: string) =>
      accessRuleError("Api", `error in response: status code 400 Bad Request: ${body}`);

    it("extracts the server message from the embedded ErrorResponseModel body", () => {
      expect(
        accessRuleErrorMessage(wrap('{"message":"A rule with that name already exists."}')),
      ).toBe("A rule with that name already exists.");
    });

    it("returns undefined when the body has no usable message", () => {
      expect(accessRuleErrorMessage(wrap('{"message":""}'))).toBeUndefined();
      expect(accessRuleErrorMessage(wrap('{"validationErrors":{}}'))).toBeUndefined();
      expect(accessRuleErrorMessage(wrap('{"message":42}'))).toBeUndefined();
    });

    it("returns undefined when there is no JSON body (network/serde failures)", () => {
      expect(accessRuleErrorMessage(accessRuleError("Api", "error in reqwest: timed out"))).toBe(
        undefined,
      );
      expect(accessRuleErrorMessage(wrap("not json"))).toBeUndefined();
    });
  });

  it("returns undefined for a plain Error", () => {
    expect(accessRuleErrorMessage(new Error("network down"))).toBeUndefined();
  });

  it("returns undefined for a look-alike object that isn't an Error instance", () => {
    expect(
      accessRuleErrorMessage({ name: "AccessRuleError", variant: "NotFound", message: "x" }),
    ).toBeUndefined();
  });

  it("returns undefined for null/undefined/non-error values", () => {
    expect(accessRuleErrorMessage(null)).toBeUndefined();
    expect(accessRuleErrorMessage(undefined)).toBeUndefined();
    expect(accessRuleErrorMessage("nope")).toBeUndefined();
  });
});

describe("isAccessRuleNotFound", () => {
  it("is true only for the NotFound variant", () => {
    expect(isAccessRuleNotFound(accessRuleError("NotFound"))).toBe(true);
  });

  it("is false for other AccessRuleError variants", () => {
    expect(isAccessRuleNotFound(accessRuleError("Validation"))).toBe(false);
    expect(isAccessRuleNotFound(accessRuleError("Api"))).toBe(false);
  });

  it("is false for a non-AccessRuleError error", () => {
    expect(isAccessRuleNotFound(new Error("NotFound"))).toBe(false);
  });

  it("is false for null/undefined", () => {
    expect(isAccessRuleNotFound(null)).toBe(false);
    expect(isAccessRuleNotFound(undefined)).toBe(false);
  });
});

describe("isAccessRuleCollectionConflict", () => {
  const CONFLICT_MESSAGE = "One or more collections are already governed by another access rule.";

  it("matches the server's collection-conflict rejection inside an Api error", () => {
    const e = accessRuleError(
      "Api",
      `error in response: status code 400 Bad Request: {"message":"${CONFLICT_MESSAGE}"}`,
    );
    expect(isAccessRuleCollectionConflict(e)).toBe(true);
  });

  it("matches the message on non-Api variants too", () => {
    expect(isAccessRuleCollectionConflict(accessRuleError("Validation", CONFLICT_MESSAGE))).toBe(
      true,
    );
  });

  it("is false for other server rejections", () => {
    const e = accessRuleError(
      "Api",
      'error in response: status code 400 Bad Request: {"message":"Name is required."}',
    );
    expect(isAccessRuleCollectionConflict(e)).toBe(false);
  });

  it("is false for non-AccessRuleError values", () => {
    expect(isAccessRuleCollectionConflict(new Error(CONFLICT_MESSAGE))).toBe(false);
    expect(isAccessRuleCollectionConflict(null)).toBe(false);
  });
});

describe("isHumanApproval", () => {
  it("matches a human_approval condition", () => {
    expect(isHumanApproval({ kind: "human_approval" })).toBe(true);
  });

  it("does not match an ip_allowlist condition", () => {
    expect(isHumanApproval({ kind: "ip_allowlist", cidrs: [] })).toBe(false);
  });
});

describe("isIpAllowlist", () => {
  it("matches an ip_allowlist condition", () => {
    expect(isIpAllowlist({ kind: "ip_allowlist", cidrs: ["10.0.0.0/8"] })).toBe(true);
  });

  it("does not match a human_approval condition", () => {
    expect(isIpAllowlist({ kind: "human_approval" })).toBe(false);
  });
});

describe("isKnownAccessCondition", () => {
  it("recognises human_approval and ip_allowlist", () => {
    expect(isKnownAccessCondition({ kind: "human_approval" })).toBe(true);
    expect(isKnownAccessCondition({ kind: "ip_allowlist", cidrs: [] })).toBe(true);
  });

  it("rejects a kind this client doesn't know about, without throwing", () => {
    expect(isKnownAccessCondition({ kind: "some_future_condition" } as never)).toBe(false);
  });
});
