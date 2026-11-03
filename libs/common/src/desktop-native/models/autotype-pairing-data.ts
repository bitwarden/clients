/*
  The types and validation in this file mirror the Autotype Pairing Data Schema, which is the
  source of truth and must be kept in sync with this file:
  apps/desktop/desktop_native/autotype/schemas/autotype-pairing-data-schema.0.1.0.json
*/

/**
 * The type of packaging of the Bitwarden client a pairing was made on. Informs the operating
 * system and potential sandboxing requirements.
 */
export const AutotypePairingPackagingType = Object.freeze({
  WindowsMsix: "windows-msix",
  WindowsExe: "windows-exe",
} as const);

export type AutotypePairingPackagingType =
  (typeof AutotypePairingPackagingType)[keyof typeof AutotypePairingPackagingType];

/**
 * The SemVer version of the Autotype Pairing Data Schema that this client reads and writes.
 */
export const AUTOTYPE_PAIRING_DATA_SCHEMA_VERSION = Object.freeze({
  major: 0,
  minor: 1,
  patch: 0,
} as const);

export type AutotypePairingDataSchemaVersion = typeof AUTOTYPE_PAIRING_DATA_SCHEMA_VERSION;

/**
 * The app pairing data saved for Autotype, as defined by the Autotype Pairing Data Schema.
 *
 * This holds decrypted vault data (including the paired app's path), so it must never be logged.
 */
export type AutotypePairingData = {
  metadata: {
    schemaVersion: AutotypePairingDataSchemaVersion;
    /** When this pairing was created, as a unix timestamp in seconds since the epoch. */
    pairingTimestamp: number;
  };
  appData: {
    /** The name of the application paired. */
    name: string;
    /** The normalized absolute path of the application paired, including the file name. */
    normalizedPath: string;
  };
  clientData: {
    packagingType: AutotypePairingPackagingType;
  };
};

export function isAutotypePairingPackagingType(
  value: unknown,
): value is AutotypePairingPackagingType {
  return Object.values(AutotypePairingPackagingType).some((type) => type === value);
}

/**
 * Returns whether the value adheres to the Autotype Pairing Data Schema: every object has exactly
 * its required properties, and every property has the type and value constraints of the schema.
 */
export function isAutotypePairingData(value: unknown): value is AutotypePairingData {
  return (
    isPlainObject(value) &&
    hasExactKeys(value, ["metadata", "appData", "clientData"]) &&
    isMetadata(value.metadata) &&
    isAppData(value.appData) &&
    isClientData(value.clientData)
  );
}

function isMetadata(value: unknown): boolean {
  if (!isPlainObject(value) || !hasExactKeys(value, ["schemaVersion", "pairingTimestamp"])) {
    return false;
  }

  const { schemaVersion, pairingTimestamp } = value;
  return (
    isSchemaVersion(schemaVersion) &&
    typeof pairingTimestamp === "number" &&
    Number.isInteger(pairingTimestamp) &&
    pairingTimestamp >= 0
  );
}

function isSchemaVersion(value: unknown): boolean {
  return (
    isPlainObject(value) &&
    hasExactKeys(value, ["major", "minor", "patch"]) &&
    value.major === AUTOTYPE_PAIRING_DATA_SCHEMA_VERSION.major &&
    value.minor === AUTOTYPE_PAIRING_DATA_SCHEMA_VERSION.minor &&
    value.patch === AUTOTYPE_PAIRING_DATA_SCHEMA_VERSION.patch
  );
}

function isAppData(value: unknown): boolean {
  return (
    isPlainObject(value) &&
    hasExactKeys(value, ["name", "normalizedPath"]) &&
    typeof value.name === "string" &&
    typeof value.normalizedPath === "string"
  );
}

function isClientData(value: unknown): boolean {
  return (
    isPlainObject(value) &&
    hasExactKeys(value, ["packagingType"]) &&
    isAutotypePairingPackagingType(value.packagingType)
  );
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// The schema requires every property and allows no additional properties, at every level.
function hasExactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actualKeys = Object.keys(value);
  return actualKeys.length === keys.length && keys.every((key) => actualKeys.includes(key));
}
