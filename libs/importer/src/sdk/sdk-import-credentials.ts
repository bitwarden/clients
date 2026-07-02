/**
 * Credentials collected for an SDK-backed importer, discriminated by {@link CredentialKind}. The
 * entry points produce this; the importer strategy consumes the variant it declared.
 */
export type SdkImportCredentials =
  | { kind: "none" }
  | { kind: "password"; password: string }
  | { kind: "passwordWithKeyFile"; password: string; keyFile: Uint8Array | null };
