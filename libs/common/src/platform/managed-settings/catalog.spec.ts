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
];

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
