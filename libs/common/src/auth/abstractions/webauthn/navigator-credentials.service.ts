export type AuthenticatorAssertionResponse = {
  clientDataJSON: Uint8Array;
  authenticatorData: Uint8Array;
  signature: Uint8Array;
  userHandle: Uint8Array | null;
};

export type PublicKeyCredential = {
  authenticatorAttachment: string;
  id: string;
  rawId: Uint8Array;
  response: AuthenticatorAssertionResponse;
  type: string;
  prf?: Uint8Array;
};

export abstract class NavigatorCredentialsService {
  abstract get(options: CredentialRequestOptions): Promise<PublicKeyCredential | null>;
  abstract available(): Promise<boolean>;
}
