import { ClientType } from "@bitwarden/client-type";
import { PlatformUtilsService } from "@bitwarden/common/platform/abstractions/platform-utils.service";

import {
  NavigatorCredentialsService,
  PublicKeyCredential as CustomPublicKeyCredential,
} from "../../abstractions/webauthn/navigator-credentials.service";

export class DefaultNavigatorCredentialsService implements NavigatorCredentialsService {
  private navigatorCredentials: CredentialsContainer;

  constructor(
    private window: Window,
    private platformUtilsService: PlatformUtilsService,
  ) {
    this.navigatorCredentials = this.window.navigator.credentials;
  }

  async get(options: CredentialRequestOptions): Promise<CustomPublicKeyCredential | null> {
    const result: PublicKeyCredential = (await this.navigatorCredentials.get(
      options,
    )) as PublicKeyCredential;
    const response: AuthenticatorAssertionResponse =
      result.response as AuthenticatorAssertionResponse;
    return {
      authenticatorAttachment: result!.authenticatorAttachment,
      id: result.id,
      rawId: new Uint8Array(result.rawId),
      response: {
        clientDataJSON: new Uint8Array(response.clientDataJSON),
        authenticatorData: new Uint8Array(response.authenticatorData),
        signature: new Uint8Array(response.signature),
        userHandle: response.userHandle ? new Uint8Array(response.userHandle) : null,
      },
      type: result.type,
      prf: bufferSourceToUint8Array(result.getClientExtensionResults().prf?.results?.first),
    };
  }

  async available(): Promise<boolean> {
    return this.platformUtilsService.getClientType() === ClientType.Web;
  }
}

function bufferSourceToUint8Array(source: BufferSource | null): Uint8Array | null {
  if (source === null) {
    return null;
  }

  if (source instanceof ArrayBuffer) {
    return new Uint8Array(source);
  } else {
    return new Uint8Array(source.buffer, source.byteOffset, source.byteLength);
  }
}
