const _CipherType = Object.freeze({
  Login: 1,
  SecureNote: 2,
  Card: 3,
  Identity: 4,
  SshKey: 5,
} as const);

type _CipherType = typeof _CipherType;

export type CipherType = _CipherType[keyof _CipherType];

// FIXME: Update typing of `CipherType` to be `Record<keyof _CipherType, CipherType>` which is ADR-0025 compliant when the TypeScript version is at least 5.8.
export const CipherType: typeof _CipherType = _CipherType;

/**
 * Reverse mapping of Cipher Types to their associated names.
 * Prefer using {@link toCipherTypeName} rather than accessing this object directly.
 *
 * When represented as an enum in TypeScript, this mapping was provided
 * by default. Now using a constant object it needs to be defined manually.
 */
export const cipherTypeNames = Object.freeze(
  Object.fromEntries(Object.entries(CipherType).map(([key, value]) => [value, key])),
) as Readonly<Record<CipherType, keyof typeof CipherType>>;

/**
 * Returns the associated name for the cipher type, will throw when the name is not found.
 */
export function toCipherTypeName(type: CipherType): keyof typeof CipherType | undefined {
  const name = cipherTypeNames[type];

  return name;
}

/**
 * @returns `true` if the value is a valid `CipherType`, `false` otherwise.
 */
export const isCipherType = (value: unknown): value is CipherType => {
  return Object.values(CipherType).includes(value as CipherType);
};

/**
 * Converts a value to a `CipherType` if it is valid, otherwise returns `null`.
 */
export const toCipherType = (value: unknown): CipherType | undefined => {
  if (isCipherType(value)) {
    return value;
  }

  if (typeof value === "string") {
    const valueAsInt = parseInt(value, 10);

    if (isCipherType(valueAsInt)) {
      return valueAsInt;
    }
  }

  return undefined;
};
