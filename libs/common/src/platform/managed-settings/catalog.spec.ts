import { MANAGED_KEY_CATALOG } from "./catalog";
import { buildChromiumManagedSchema } from "./managed-schema";

const SDK_KEYS = [
  "generator.password.lowercase",
  "generator.password.uppercase",
  "generator.password.numbers",
  "generator.password.special",
  "generator.password.avoidAmbiguous",
  "generator.password.length",
  "generator.password.minLowercase",
  "generator.password.minUppercase",
  "generator.password.minNumber",
  "generator.password.minSpecial",
  "generator.passphrase.numWords",
  "generator.passphrase.wordSeparator",
  "generator.passphrase.capitalize",
  "generator.passphrase.includeNumber",
];

const TS_KEYS = [
  "environment.base",
  "environment.webVault",
  "environment.api",
  "environment.identity",
  "environment.icons",
  "environment.notifications",
  "environment.events",
  "theming.selection",
  "theming.compactMode",
  "translation.locale",
  "vaultAppearance.copyButtons",
];

// Pins every key's JSON type. The SDK generator types mirror the readers in
// crates/bitwarden-generators/src/managed_overrides.rs (read_bool -> boolean,
// read_u8_clamped -> integer, read_string_nonempty -> string); a hand-mirror type
// error is the highest-risk drift, so it must be deliberate.
const KEY_TYPES: Record<string, "string" | "boolean" | "integer"> = {
  "environment.base": "string",
  "environment.webVault": "string",
  "environment.api": "string",
  "environment.identity": "string",
  "environment.icons": "string",
  "environment.notifications": "string",
  "environment.events": "string",
  "theming.selection": "string",
  "theming.compactMode": "boolean",
  "translation.locale": "string",
  "vaultAppearance.copyButtons": "string",
  "generator.password.lowercase": "boolean",
  "generator.password.uppercase": "boolean",
  "generator.password.numbers": "boolean",
  "generator.password.special": "boolean",
  "generator.password.avoidAmbiguous": "boolean",
  "generator.password.length": "integer",
  "generator.password.minLowercase": "integer",
  "generator.password.minUppercase": "integer",
  "generator.password.minNumber": "integer",
  "generator.password.minSpecial": "integer",
  "generator.passphrase.numWords": "integer",
  "generator.passphrase.wordSeparator": "string",
  "generator.passphrase.capitalize": "boolean",
  "generator.passphrase.includeNumber": "boolean",
};

describe("MANAGED_KEY_CATALOG", () => {
  it("pins the SDK-consumed key set (mirror of managed_overrides.rs)", () => {
    const sdk = MANAGED_KEY_CATALOG.filter((d) => d.origin === "sdk").map((d) => d.key);
    expect(sdk.sort()).toEqual([...SDK_KEYS].sort());
  });

  it("pins the TS-only key set", () => {
    const ts = MANAGED_KEY_CATALOG.filter((d) => d.origin === "ts").map((d) => d.key);
    expect(ts.sort()).toEqual([...TS_KEYS].sort());
  });

  it("has no duplicate keys", () => {
    const keys = MANAGED_KEY_CATALOG.map((d) => d.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("pins each key's JSON type so a hand-mirror type error is deliberate", () => {
    const actual = Object.fromEntries(MANAGED_KEY_CATALOG.map((d) => [d.key, d.type]));
    expect(actual).toEqual(KEY_TYPES);
  });
});

describe("buildChromiumManagedSchema", () => {
  it("nests dotted keys into object properties with type and description", () => {
    const schema = buildChromiumManagedSchema();
    expect(schema.type).toBe("object");
    expect(schema.properties?.environment.properties?.base).toEqual({
      type: "string",
      description: "Base URL; typically only this value needs to be set.",
    });
  });

  it("includes the generator keys so an admin can set them", () => {
    const schema = buildChromiumManagedSchema();
    const password = schema.properties?.generator.properties?.password.properties;
    expect(password?.length).toEqual({ type: "integer", description: "Force password length." });
    expect(password?.lowercase.type).toBe("boolean");
    const passphrase = schema.properties?.generator.properties?.passphrase.properties;
    expect(passphrase?.wordSeparator.type).toBe("string");
  });

  it("emits every catalog key as a leaf", () => {
    const schema = buildChromiumManagedSchema();
    const leaves: string[] = [];
    const walk = (node: { properties?: Record<string, any> }, prefix: string) => {
      for (const [name, child] of Object.entries(node.properties ?? {})) {
        const path = prefix === "" ? name : `${prefix}.${name}`;
        if (child.properties) {
          walk(child, path);
        } else {
          leaves.push(path);
        }
      }
    };
    walk(schema, "");
    expect(leaves.sort()).toEqual(MANAGED_KEY_CATALOG.map((d) => d.key).sort());
  });
});
