/*
  The types and validation in this file mirror the Autotype Pairing Data Schema, which is the
  source of truth and must be kept in sync with this file:
  libs/common/src/desktop-native/schemas/autotype-pairing-data-schema.1.0.0.json

  Every 1.x.y version of the schema stays compatible with 1.0.0: a minor version may only add
  optional properties or new `packagingType` values. Mirroring 1.0.0 while ignoring unknown
  properties therefore accepts data of every 1.x.y version.

  Handling this in an automated fashion is future work scoped in ticket:
  https://bitwarden.atlassian.net/browse/PM-43969
*/

import { LiteralUnion } from "type-fest";

/**
 * The known types of packaging of the Bitwarden client a pairing was made on. Informs the
 * operating system and potential sandboxing requirements.
 *
 * Later 1.x versions of the schema may add values, so pairing data can hold a `packagingType`
 * that isn't listed here.
 */
export const AutotypePairingPackagingType = Object.freeze({
  WindowsMsix: "windows-msix",
  WindowsExe: "windows-exe",
} as const);

export type AutotypePairingPackagingType =
  (typeof AutotypePairingPackagingType)[keyof typeof AutotypePairingPackagingType];

/**
 * The SemVer version of the Autotype Pairing Data Schema that new pairing data is written with.
 */
export const AUTOTYPE_PAIRING_DATA_SCHEMA_VERSION = Object.freeze({
  major: 1,
  minor: 0,
  patch: 0,
} as const);

/** A SemVer version of the Autotype Pairing Data Schema that this client reads (any 1.x.y). */
export type AutotypePairingDataSchemaVersion = {
  major: 1;
  minor: number;
  patch: number;
};

/**
 * The app pairing data saved for Autotype, as defined by the Autotype Pairing Data Schema.
 *
 * Data written by a later 1.x version can hold properties that aren't declared here. They are
 * kept as-is.
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
    /** The name of the application paired. Never empty. */
    name: string;
    /**
     * The normalized absolute path of the application paired, including the file name. Never
     * empty.
     */
    normalizedPath: string;
  };
  clientData: {
    /**
     * The type of packaging of the Bitwarden client this pairing was made on: one of
     * {@link AutotypePairingPackagingType}, or a value added by a later 1.x version. Never empty.
     *
     * A `===` check doesn't narrow this type. Use {@link isAutotypePairingPackagingType} to narrow
     * it to a known value.
     */
    packagingType: LiteralUnion<AutotypePairingPackagingType, string>;
  };
};

/** Returns whether the value is one of the known {@link AutotypePairingPackagingType} values. */
export function isAutotypePairingPackagingType(
  value: unknown,
): value is AutotypePairingPackagingType {
  return Object.values(AutotypePairingPackagingType).some((type) => type === value);
}

/**
 * Returns whether the value adheres to a 1.x.y version of the Autotype Pairing Data Schema: every
 * object has its required properties, and every property has the type and value constraints of
 * the schema. Unknown properties are ignored.
 */
export function isAutotypePairingData(value: unknown): value is AutotypePairingData {
  return (
    isPlainObject(value) &&
    hasKeys(value, ["metadata", "appData", "clientData"]) &&
    isMetadata(value.metadata) &&
    isAppData(value.appData) &&
    isClientData(value.clientData)
  );
}

// Validates `metadata`: a supported schema version and a non-negative integer timestamp.
function isMetadata(value: unknown): boolean {
  if (!isPlainObject(value) || !hasKeys(value, ["schemaVersion", "pairingTimestamp"])) {
    return false;
  }

  const { schemaVersion, pairingTimestamp } = value;
  return isSchemaVersion(schemaVersion) && isNonNegativeInteger(pairingTimestamp);
}

// Validates `schemaVersion`: major version 1, with any non-negative integer minor and patch.
function isSchemaVersion(value: unknown): boolean {
  return (
    isPlainObject(value) &&
    hasKeys(value, ["major", "minor", "patch"]) &&
    value.major === AUTOTYPE_PAIRING_DATA_SCHEMA_VERSION.major &&
    isNonNegativeInteger(value.minor) &&
    isNonNegativeInteger(value.patch)
  );
}

// Validates `appData`: a non-empty name and a non-empty path.
function isAppData(value: unknown): boolean {
  return (
    isPlainObject(value) &&
    hasKeys(value, ["name", "normalizedPath"]) &&
    isNonEmptyString(value.name) &&
    isNonEmptyString(value.normalizedPath)
  );
}

// Validates `clientData`: a non-empty packaging type, known or not.
function isClientData(value: unknown): boolean {
  return (
    isPlainObject(value) &&
    hasKeys(value, ["packagingType"]) &&
    isNonEmptyString(value.packagingType)
  );
}

// Matches the schema's `"type": "string", "minLength": 1`.
function isNonEmptyString(value: unknown): boolean {
  return typeof value === "string" && value.length > 0;
}

// Matches the schema's `"type": "integer", "minimum": 0`.
function isNonNegativeInteger(value: unknown): boolean {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

// Matches the schema's `"type": "object"`, which excludes `null` and arrays.
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// The schema requires these properties. Any other properties are allowed and ignored.
function hasKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  const actualKeys = Object.keys(value);
  return keys.every((key) => actualKeys.includes(key));
}
