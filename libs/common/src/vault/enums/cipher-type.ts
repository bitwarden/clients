import { UnionOfValues } from "../types/union-of-values";

export const CipherType = {
  Login: 1,
  SecureNote: 2,
  Card: 3,
  Identity: 4,
  SshKey: 5,
} as const;

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
export function toCipherTypeName(type: CipherType): keyof typeof CipherType {
  const name = cipherTypeNames[type];

  // This shouldn't happen but to be safe throw if the type isn't found
  if (name === undefined) {
    throw new Error(`Name for cipher type ${type} not found.`);
  }

  return name;
}

export type CipherType = UnionOfValues<typeof CipherType>;
