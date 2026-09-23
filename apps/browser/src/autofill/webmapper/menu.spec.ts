import { ROOT_ID } from "@bitwarden/common/autofill/constants";

import { ACTION_KEYS, FIELD_KEYS } from "./keys";
import {
  isWebmapperMenuId,
  parseWebmapperMenuId,
  webmapperContextMenuItems,
  WEBMAPPER_CONTAINER_ID,
  WEBMAPPER_IRRELEVANT_ID,
  WEBMAPPER_ROOT_ID,
} from "./menu";

describe("webmapper menu", () => {
  describe("webmapperContextMenuItems", () => {
    const items = webmapperContextMenuItems();

    // The dev flag is what keeps these developer tools out of production builds:
    // main-context-menu-handler drops any item whose requiresDevFlag is off, so an
    // item that omits it ships to every user.
    it("gates every item behind the fillAssistDevTools dev flag", () => {
      const ungated = items.filter((i) => i.requiresDevFlag !== "fillAssistDevTools");

      expect(ungated).toEqual([]);
    });

    it("hangs every item off the webmapper root, and the root off the Bitwarden root", () => {
      const ids = new Set(items.map((i) => i.id));
      const root = items.find((i) => i.id === WEBMAPPER_ROOT_ID);

      expect(root?.parentId).toBe(ROOT_ID);
      for (const item of items.filter((i) => i.id !== WEBMAPPER_ROOT_ID)) {
        expect(ids.has(item.parentId as string)).toBe(true);
      }
    });

    it("uses unique ids", () => {
      const ids = items.map((i) => i.id);

      expect(ids).toHaveLength(new Set(ids).size);
    });

    it("emits a leaf for every field and action key, each resolving to its action", () => {
      const fieldKeys = Object.values(FIELD_KEYS).flat();

      for (const key of fieldKeys) {
        expect(parseWebmapperMenuId(`webmapper:field:${key}`)).toEqual({ kind: "field", key });
        expect(items.some((i) => i.id === `webmapper:field:${key}`)).toBe(true);
      }
      for (const key of ACTION_KEYS) {
        expect(parseWebmapperMenuId(`webmapper:action:${key}`)).toEqual({ kind: "action", key });
        expect(items.some((i) => i.id === `webmapper:action:${key}`)).toBe(true);
      }
    });

    it("claims every id it emits", () => {
      for (const item of items) {
        expect(isWebmapperMenuId(item.id as string)).toBe(true);
      }
    });
  });

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
