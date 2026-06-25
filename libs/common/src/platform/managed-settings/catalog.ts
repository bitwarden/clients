/** JSON type of a managed value, used to generate the admin schema. */
export type ManagedKeyType = "string" | "boolean" | "integer";

/** Where a key is consumed: the SDK (via ApplyManagedOverride) or the TS StateProvider overlay. */
export type ManagedKeyOrigin = "sdk" | "ts";

export interface ManagedKeyDescriptor {
  /** The canonical dotted key. */
  readonly key: string;
  /** JSON type of the value. */
  readonly type: ManagedKeyType;
  /** Consumer of the key. A TS-only key never has origin "sdk". */
  readonly origin: ManagedKeyOrigin;
  /** Administrator-facing description, surfaced in the generated schema. */
  readonly description: string;
}

/**
 * The canonical managed-key catalog: the union of SDK-consumed keys and TS-only keys. This is the
 * single source of truth in this repo. `managed_schema.json` is generated from it, and CI fails if
 * the committed schema or the SDK-key set diverges (see managed-schema.spec.ts and catalog.spec.ts).
 *
 * The "sdk" entries mirror crates/bitwarden-generators/src/managed_overrides.rs by hand, because the
 * SDK does not export a managed-keys.json yet. When it does, this hand-mirrored set is replaced by
 * the SDK manifest without changing the descriptor shape.
 */
export const MANAGED_KEY_CATALOG: readonly ManagedKeyDescriptor[] = [
  // TS-only: environment URLs, consumed by the TS StateProvider overlay (environment.overlay.ts).
  {
    key: "environment.base",
    type: "string",
    origin: "ts",
    description: "Base URL; typically only this value needs to be set.",
  },
  { key: "environment.webVault", type: "string", origin: "ts", description: "Web vault URL." },
  { key: "environment.api", type: "string", origin: "ts", description: "API URL." },
  { key: "environment.identity", type: "string", origin: "ts", description: "Identity URL." },
  { key: "environment.icons", type: "string", origin: "ts", description: "Icons URL." },
  {
    key: "environment.notifications",
    type: "string",
    origin: "ts",
    description: "Notifications URL.",
  },
  { key: "environment.events", type: "string", origin: "ts", description: "Events URL." },
  // TS-only: appearance settings, consumed by the TS StateProvider overlay.
  {
    key: "theming.selection",
    type: "string",
    origin: "ts",
    description: "Application color theme.",
  },
  {
    key: "theming.compactMode",
    type: "boolean",
    origin: "ts",
    description: "Compact display mode.",
  },
  {
    key: "translation.locale",
    type: "string",
    origin: "ts",
    description: "Application language (locale).",
  },
  {
    key: "vaultAppearance.copyButtons",
    type: "string",
    origin: "ts",
    description: "Copy-button display mode.",
  },
  // SDK-consumed: generator, resolved in the SDK via ApplyManagedOverride. Mirror of
  // crates/bitwarden-generators/src/managed_overrides.rs.
  {
    key: "generator.password.lowercase",
    type: "boolean",
    origin: "sdk",
    description: "Force including lowercase characters.",
  },
  {
    key: "generator.password.uppercase",
    type: "boolean",
    origin: "sdk",
    description: "Force including uppercase characters.",
  },
  {
    key: "generator.password.numbers",
    type: "boolean",
    origin: "sdk",
    description: "Force including numbers.",
  },
  {
    key: "generator.password.special",
    type: "boolean",
    origin: "sdk",
    description: "Force including special characters.",
  },
  {
    key: "generator.password.avoidAmbiguous",
    type: "boolean",
    origin: "sdk",
    description: "Force avoiding ambiguous characters.",
  },
  {
    key: "generator.password.length",
    type: "integer",
    origin: "sdk",
    description: "Force password length.",
  },
  {
    key: "generator.password.minLowercase",
    type: "integer",
    origin: "sdk",
    description: "Force the minimum number of lowercase characters.",
  },
  {
    key: "generator.password.minUppercase",
    type: "integer",
    origin: "sdk",
    description: "Force the minimum number of uppercase characters.",
  },
  {
    key: "generator.password.minNumber",
    type: "integer",
    origin: "sdk",
    description: "Force the minimum number of numeric characters.",
  },
  {
    key: "generator.password.minSpecial",
    type: "integer",
    origin: "sdk",
    description: "Force the minimum number of special characters.",
  },
  {
    key: "generator.passphrase.numWords",
    type: "integer",
    origin: "sdk",
    description: "Force the number of words.",
  },
  {
    key: "generator.passphrase.wordSeparator",
    type: "string",
    origin: "sdk",
    description: "Force the word separator.",
  },
  {
    key: "generator.passphrase.capitalize",
    type: "boolean",
    origin: "sdk",
    description: "Force capitalization.",
  },
  {
    key: "generator.passphrase.includeNumber",
    type: "boolean",
    origin: "sdk",
    description: "Force including a number.",
  },
];
