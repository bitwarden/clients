import {
  isWebmapperMenuId,
  parseWebmapperMenuId,
  WEBMAPPER_CONTAINER_ID,
  WEBMAPPER_IRRELEVANT_ID,
  WEBMAPPER_ROOT_ID,
} from "./menu";

describe("webmapper menu", () => {
  describe("isWebmapperMenuId", () => {
    it("recognizes the root id and any namespaced child id", () => {
      expect(isWebmapperMenuId(WEBMAPPER_ROOT_ID)).toBe(true);
      expect(isWebmapperMenuId(WEBMAPPER_CONTAINER_ID)).toBe(true);
      expect(isWebmapperMenuId("webmapper:field:username")).toBe(true);
    });

    it("rejects ids that don't belong to webmapper", () => {
      expect(isWebmapperMenuId("autofill")).toBe(false);
      expect(isWebmapperMenuId("copy-username")).toBe(false);
      expect(isWebmapperMenuId("webmapperish")).toBe(false); // no ":" separator
    });
  });

  describe("parseWebmapperMenuId", () => {
    it("maps the irrelevant and container ids to their actions", () => {
      expect(parseWebmapperMenuId(WEBMAPPER_IRRELEVANT_ID)).toEqual({ kind: "toggle-irrelevant" });
      expect(parseWebmapperMenuId(WEBMAPPER_CONTAINER_ID)).toEqual({ kind: "set-container" });
    });

    it("extracts the key from field and action leaf ids", () => {
      expect(parseWebmapperMenuId("webmapper:field:username")).toEqual({
        kind: "field",
        key: "username",
      });
      expect(parseWebmapperMenuId("webmapper:action:submit")).toEqual({
        kind: "action",
        key: "submit",
      });
    });

    it("returns null for non-actionable parents and unknown ids", () => {
      expect(parseWebmapperMenuId(WEBMAPPER_ROOT_ID)).toBeNull();
      expect(parseWebmapperMenuId("webmapper:fieldgroup:contact")).toBeNull();
      expect(parseWebmapperMenuId("autofill")).toBeNull();
    });
  });
});
