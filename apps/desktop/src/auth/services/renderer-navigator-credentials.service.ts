import { navigator_credentials } from "apps/desktop/desktop_native/napi";

import { NavigatorCredentialsService } from "@bitwarden/common/auth/abstractions/webauthn/navigator-credentials.service";

export class RendererNavigatorCredentialsService implements NavigatorCredentialsService {
  constructor() {}

  async get(options: CredentialRequestOptions): Promise<Credential | null> {
    return await ipc.auth.navigatorCredentialsGet({
      challenge: arrayBufferSourceToUint8Array(options.publicKey.challenge),
      timeout: options.publicKey.timeout,
      rpId: options.publicKey.rpId,
      userVerification: convertUserVerification(options.publicKey.userVerification),
      allowCredentials: options.publicKey.allowCredentials.map((cred) => {
        return arrayBufferSourceToUint8Array(cred.id);
      }),
      prf: options.publicKey.extensions?.prf
        ? {
            first: arrayBufferSourceToUint8Array(options.publicKey.extensions!.prf!.eval.first),
            second: undefined,
          }
        : undefined,
    });
  }

  async available(): Promise<boolean> {
    return await ipc.auth.navigatorCredentialsAvailable();
  }
}

function arrayBufferSourceToUint8Array(source: BufferSource): Uint8Array {
  if (source instanceof ArrayBuffer) {
    return new Uint8Array(source);
  } else {
    return new Uint8Array(source.buffer, source.byteOffset, source.byteLength);
  }
}

function convertUserVerification(
  userVerification: UserVerificationRequirement | undefined,
): navigator_credentials.UserVerification | undefined {
  switch (userVerification) {
    case "required":
      return navigator_credentials.UserVerification.Required;
    case "preferred":
      return navigator_credentials.UserVerification.Preferred;
    case "discouraged":
      return navigator_credentials.UserVerification.Discouraged;
    default:
      return undefined;
  }
}
