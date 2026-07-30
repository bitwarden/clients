import { ErrorResponse } from "@bitwarden/common/models/response/error.response";

import { isErrorResponse, isSendContext } from "./util";

describe("util", () => {
  describe("isErrorResponse", () => {
    it("returns true when value is an ErrorResponse instance", () => {
      const error = new ErrorResponse(["Error message"], 400);
      expect(isErrorResponse(error)).toBe(true);
    });

    it.each([
      [null, "null"],
      [undefined, "undefined"],
    ])("returns false when value is %s", (value, description) => {
      expect(isErrorResponse(value)).toBe(false);
    });

    it.each([
      ["string", "string"],
      [123, "number"],
      [true, "boolean"],
      [{}, "plain object"],
      [[], "array"],
    ])("returns false when value is not an ErrorResponse (%s)", (value, description) => {
      expect(isErrorResponse(value)).toBe(false);
    });

    it("returns false when value is a different Error type", () => {
      const error = new Error("test");
      expect(isErrorResponse(error)).toBe(false);
    });
  });

  describe("isSendContext", () => {
    it("returns true when value has id and key properties", () => {
      const validContext = { id: "test-id", key: "test-key" };
      expect(isSendContext(validContext)).toBe(true);
    });

    it("returns true even with additional properties", () => {
      const contextWithExtras = { id: "test-id", key: "test-key", extra: "data" };
      expect(isSendContext(contextWithExtras)).toBe(true);
    });

    it.each([
      [null, "null"],
      [undefined, "undefined"],
    ])("returns false when value is %s", (value, _) => {
      expect(isSendContext(value)).toBe(false);
    });

    it.each([
      ["string", "string"],
      [123, "number"],
      [true, "boolean"],
    ])("returns false when value is not an object (%s)", (value, _) => {
      expect(isSendContext(value)).toBe(false);
    });

    it.each([
      [{ key: "test-key" }, "missing id"],
      [{ id: "test-id" }, "missing key"],
      [{}, "empty object"],
    ])("returns false when value is %s", (value, _) => {
      expect(isSendContext(value)).toBe(false);
    });
  });
});
