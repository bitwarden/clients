export const SigningKeyTypes = {
  Ed25519: "ed25519",
} as const;

export type SigningKeyType = (typeof SigningKeyTypes)[keyof typeof SigningKeyTypes];
export function parseSigningKeyTypeFromString(value: string): SigningKeyType {
  switch (value) {
    case SigningKeyTypes.Ed25519:
      return SigningKeyTypes.Ed25519;
    default:
      throw new Error(`Unknown signing key type: ${value}`);
  }
}
