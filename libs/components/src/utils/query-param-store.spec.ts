import { convertToParamMap } from "@angular/router";

import {
  decodeNamespace,
  decodeParam,
  encodeNamespace,
  encodeParamValue,
} from "./query-param-store";

describe("query-param-store codec", () => {
  describe("encodeParamValue", () => {
    it("passes strings through", () => {
      expect(encodeParamValue("login")).toBe("login");
    });

    it("encodes booleans as words", () => {
      expect(encodeParamValue(true)).toBe("true");
      expect(encodeParamValue(false)).toBe("false");
    });

    it("stringifies numbers", () => {
      expect(encodeParamValue(42)).toBe("42");
    });

    it("encodes arrays as a list, dropping empties", () => {
      expect(encodeParamValue(["a", "b"])).toEqual(["a", "b"]);
      expect(encodeParamValue(["a", ""])).toEqual(["a"]);
    });

    it("omits empty values", () => {
      expect(encodeParamValue(undefined)).toBeNull();
      expect(encodeParamValue("")).toBeNull();
      expect(encodeParamValue([])).toBeNull();
    });
  });

  describe("decodeParam", () => {
    it("coerces a lone boolean word", () => {
      expect(decodeParam(["true"])).toBe(true);
      expect(decodeParam(["false"])).toBe(false);
    });

    it("coerces a lone integer", () => {
      expect(decodeParam(["42"])).toBe(42);
    });

    it("leaves other strings alone", () => {
      expect(decodeParam(["login"])).toBe("login");
    });

    it("returns an array for repeated params, coercing each", () => {
      expect(decodeParam(["1", "2"])).toEqual([1, 2]);
    });

    it("round-trips an encoded value", () => {
      const encoded = encodeParamValue(["eng", "ops"]) as string[];
      expect(decodeParam(encoded)).toEqual(["eng", "ops"]);
    });
  });

  describe("namespace mapping", () => {
    it("reads only its own namespace, un-prefixing keys", () => {
      const params = convertToParamMap({
        "vault.type": "login",
        "vault.favorite": "true",
        "other.type": "card",
      });
      expect(decodeNamespace(params, "vault")).toEqual({ type: "login", favorite: true });
    });

    it("writes each key as a namespaced param, removing empties with null", () => {
      expect(
        encodeNamespace("vault", { type: "login", favorite: false, vault: undefined }),
      ).toEqual({
        "vault.type": "login",
        "vault.favorite": "false",
        "vault.vault": null,
      });
    });

    it("round-trips a state record through encode/decode", () => {
      const state = { type: "login", tags: ["eng", "ops"], page: 2 };
      const patch = encodeNamespace("vault", state);
      const params = convertToParamMap(patch as Record<string, string | string[]>);
      expect(decodeNamespace(params, "vault")).toEqual(state);
    });
  });
});
