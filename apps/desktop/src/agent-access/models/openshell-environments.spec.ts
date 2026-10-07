import {
  cleanOpenShellPurpose,
  parseOpenShellEnvironmentBody,
  parseOpenShellSecretRef,
  parseOpenShellSecretRefs,
} from "./openshell-environments";

const ITEM = "0b6f5d1e-3c2a-4d7e-9f10-aa11bb22cc33";
const SECRET = "1c7a6e2f-4d3b-4e8f-8a21-bb22cc33dd44";

const ref = (overrides: Record<string, unknown> = {}) => ({
  resourceType: "secret",
  id: SECRET,
  field: "value",
  label: "GitHub",
  profileId: "github",
  envVar: "GH_TOKEN",
  ...overrides,
});

describe("openshell environments contract (§M8.20 rule 17)", () => {
  describe("parseOpenShellSecretRef", () => {
    it("accepts a complete ref and drops unknown fields", () => {
      expect(parseOpenShellSecretRef({ ...ref(), value: "hunter2" })).toEqual(ref());
    });

    it.each([
      ["a non-lowercase id", { id: SECRET.toUpperCase() }],
      ["a field that does not fit the type", { resourceType: "item", field: "value" }],
      ["a bad profile id", { profileId: "-x" }],
      ["a lowercase env var", { envVar: "gh_token" }],
      ["a denied env var", { envVar: "LD_PRELOAD" }],
      ["a denied DYLD env var", { envVar: "DYLD_INSERT_LIBRARIES" }],
      ["a non-string label", { label: 5 }],
    ])("rejects %s", (_name, override) => {
      expect(parseOpenShellSecretRef(ref(override))).toBeNull();
    });

    it("cleans bidi and control characters from the label", () => {
      expect(parseOpenShellSecretRef(ref({ label: "  a\u202Eb\u0007c\u200B " }))!.label).toBe(
        "abc",
      );
    });

    it("rejects non-objects", () => {
      for (const v of [null, "x", 3, [ref()]]) {
        expect(parseOpenShellSecretRef(v)).toBeNull();
      }
    });
  });

  describe("parseOpenShellSecretRefs", () => {
    it("rejects a duplicate env var, a bad entry and too many entries", () => {
      expect(parseOpenShellSecretRefs([ref(), ref({ id: ITEM })])).toBeNull();
      expect(parseOpenShellSecretRefs([ref(), { nope: 1 }])).toBeNull();
      const many = Array.from({ length: 31 }, (_, i) => ref({ envVar: `V${i}` }));
      expect(parseOpenShellSecretRefs(many)).toBeNull();
      expect(parseOpenShellSecretRefs("x")).toBeNull();
    });

    it("accepts an empty list and distinct env vars", () => {
      expect(parseOpenShellSecretRefs([])).toEqual([]);
      expect(parseOpenShellSecretRefs([ref(), ref({ envVar: "OTHER" })])).toHaveLength(2);
    });
  });

  describe("parseOpenShellEnvironmentBody", () => {
    const base = { name: "  Dev  ", description: "d" };

    it("normalises a minimal environment", () => {
      expect(parseOpenShellEnvironmentBody(base)).toEqual({ name: "Dev", description: "d" });
      expect(parseOpenShellEnvironmentBody({ name: "x" })).toEqual({ name: "x", description: "" });
    });

    it("keeps image, resources and a set id", () => {
      expect(
        parseOpenShellEnvironmentBody({
          ...base,
          from: "ghcr.io/acme/base:1",
          cpu: "2",
          memory: "4Gi",
          secretSetId: ITEM,
        }),
      ).toEqual({
        name: "Dev",
        description: "d",
        from: "ghcr.io/acme/base:1",
        cpu: "2",
        memory: "4Gi",
        secretSetId: ITEM,
      });
    });

    it.each([
      ["an empty name", { name: "  " }],
      ["a non-string name", { name: 4 }],
      ["both image and template", { from: "a/b", template: "t" }],
      ["a path as image", { from: "../x" }],
      ["an archive as image", { from: "a/b.tar" }],
      ["a flag as template", { template: "--rm" }],
      ["a bad cpu", { cpu: "lots" }],
      ["a bad memory", { memory: "1 GB" }],
      ["a non-uuid set id", { secretSetId: "abc" }],
      ["both a set and inline secrets", { secretSetId: ITEM, secrets: [ref()] }],
      ["an invalid inline ref", { secrets: [{ ...ref(), envVar: "PATH" }] }],
    ])("rejects %s", (_name, override) => {
      expect(parseOpenShellEnvironmentBody({ ...base, ...override })).toBeNull();
    });

    it("treats empty strings as unset and an empty inline list as none", () => {
      expect(
        parseOpenShellEnvironmentBody({ ...base, from: "", template: "", cpu: "", secrets: [] }),
      ).toEqual({ name: "Dev", description: "d" });
    });

    it("caps name and description", () => {
      const body = parseOpenShellEnvironmentBody({
        name: "n".repeat(100),
        description: "d".repeat(500),
      });
      expect(body!.name).toHaveLength(60);
      expect(body!.description).toHaveLength(200);
    });
  });

  describe("cleanOpenShellPurpose", () => {
    it("makes one line, strips invisible characters and caps at 120", () => {
      expect(cleanOpenShellPurpose("  a\nb\t\tc \u202E d\u200B ")).toBe("a b c d");
      expect(cleanOpenShellPurpose("x".repeat(300))).toHaveLength(120);
      expect(cleanOpenShellPurpose("x".repeat(119) + " y")).toBe("x".repeat(119));
    });
  });
});
