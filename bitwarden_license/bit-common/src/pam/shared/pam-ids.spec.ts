import { parseGuid, sdkIdToString, toSdkId } from "./pam-ids";
import { PamInputError } from "./pam-input-error";

const GUID = "AAAAAAAA-BBBB-4CCC-8DDD-EEEEEEEEEEEE";

describe("parseGuid", () => {
  it("lowercases a valid GUID", () => {
    expect(parseGuid(GUID, "organization id")).toBe(GUID.toLowerCase());
  });

  it("trims surrounding whitespace", () => {
    expect(parseGuid(` ${GUID}\n`, "id")).toBe(GUID.toLowerCase());
  });

  it.each([undefined, null, "", "not-a-guid", "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee-extra"])(
    "refuses %p",
    (value) => {
      expect(() => parseGuid(value, "lease id")).toThrow(PamInputError);
      expect(() => parseGuid(value, "lease id")).toThrow("is not a valid lease id (GUID).");
    },
  );

  it("cleans the echoed input", () => {
    expect(() => parseGuid("bad\u001b[31m", "id")).toThrow("`bad[31m`");
  });
});

describe("toSdkId and sdkIdToString", () => {
  it("round-trips a lowercased id", () => {
    expect(sdkIdToString(toSdkId(GUID, "id"))).toBe(GUID.toLowerCase());
  });

  it("refuses a non-GUID", () => {
    expect(() => toSdkId("nope", "id")).toThrow(PamInputError);
  });
});
