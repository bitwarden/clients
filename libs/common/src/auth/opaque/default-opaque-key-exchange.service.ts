import { firstValueFrom } from "rxjs";

import { RotateableKeySet } from "@bitwarden/auth/common";
import { SdkService } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { EncString } from "@bitwarden/common/platform/models/domain/enc-string";
import { OpaqueSessionId } from "@bitwarden/common/types/guid";

import { UserKey } from "../../types/key";

import { CipherConfiguration } from "./models/cipher-configuration";
import { LoginFinishRequest } from "./models/login-finish.request";
import { LoginStartRequest } from "./models/login-start.request";
import { RegistrationFinishRequest } from "./models/registration-finish.request";
import { RegistrationStartRequest } from "./models/registration-start.request";
import { OpaqueKeyExchangeApiService } from "./opaque-key-exchange-api.service";
import { OpaqueKeyExchangeService } from "./opaque-key-exchange.service";

export class DefaultOpaqueKeyExchangeService implements OpaqueKeyExchangeService {
  constructor(
    private opaqueKeyExchangeApiService: OpaqueKeyExchangeApiService,
    private sdkService: SdkService,
  ) {}

  async register(
    masterPassword: string,
    userKey: UserKey,
    cipherConfig: CipherConfiguration,
  ): Promise<OpaqueSessionId> {
    if (!masterPassword || !userKey || !cipherConfig) {
      throw new Error(
        `Unable to register user with missing parameters. masterPassword exists: ${!!masterPassword}, userKey exists: ${!!userKey}, cipherConfig exists: ${!!cipherConfig}`,
      );
    }

    const cryptoClient = (await firstValueFrom(this.sdkService.client$)).crypto();

    const registrationStart = cryptoClient.opaque_register_start(
      masterPassword,
      cipherConfig.toSdkConfig(),
    );
    const registrationStartResponse = await this.opaqueKeyExchangeApiService.registrationStart(
      new RegistrationStartRequest(
        Utils.fromBufferToB64(registrationStart.registration_request),
        cipherConfig,
      ),
    );

    const registrationFinish = cryptoClient.opaque_register_finish(
      masterPassword,
      cipherConfig.toSdkConfig(),
      Utils.fromB64ToArray(registrationStartResponse.registrationResponse),
      registrationStart.state,
    );

    const sdkKeyset = cryptoClient.create_rotateablekeyset_from_exportkey(
      registrationFinish.export_key,
      userKey.key,
    );
    const keyset = new RotateableKeySet(
      new EncString(sdkKeyset.encapsulated_key),
      new EncString(sdkKeyset.public_key),
      new EncString(sdkKeyset.private_key),
    );

    await this.opaqueKeyExchangeApiService.registrationFinish(
      new RegistrationFinishRequest(
        registrationStartResponse.sessionId,
        Utils.fromBufferToB64(registrationFinish.registration_upload),
        keyset,
      ),
    );

    return registrationStartResponse.sessionId;
  }

  // TODO: we will likely have to break this apart to return the start / finish requests
  // so that the opaque login strategy can send both to the identity token endpoint
  // in separate calls.
  async login(
    email: string,
    masterPassword: string,
    cipherConfig: CipherConfiguration,
  ): Promise<Uint8Array> {
    if (!email || !masterPassword || !cipherConfig) {
      throw new Error(
        `Unable to log in user with missing parameters. email exists: ${!!email}; masterPassword exists: ${!!masterPassword}; cipherConfig exists: ${!!cipherConfig}`,
      );
    }

    const cryptoClient = (await firstValueFrom(this.sdkService.client$)).crypto();

    const loginStart = cryptoClient.opaque_login_start(masterPassword, cipherConfig.toSdkConfig());
    const loginStartResponse = await this.opaqueKeyExchangeApiService.loginStart(
      new LoginStartRequest(email, Utils.fromBufferToB64(loginStart.credential_request)),
    );

    const loginFinish = cryptoClient.opaque_login_finish(
      masterPassword,
      cipherConfig.toSdkConfig(),
      Utils.fromB64ToArray(loginStartResponse.credentialResponse),
      loginStart.state,
    );

    const success = await this.opaqueKeyExchangeApiService.loginFinish(
      new LoginFinishRequest(
        loginStartResponse.sessionId,
        Utils.fromBufferToB64(loginFinish.credential_finalization),
      ),
    );
    if (!success) {
      throw new Error("Login failed");
    }

    return loginFinish.export_key;
  }
}
