import { firstValueFrom } from "rxjs";

import { RotateableKeySet } from "@bitwarden/auth/common";
import { SdkService } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { EncString } from "@bitwarden/common/platform/models/domain/enc-string";
import { OpaqueSessionId } from "@bitwarden/common/types/guid";

import { UserKey } from "../../types/key";

import { Argon2IdParameters, CipherConfiguration } from "./models/cipher-configuration";
import { LoginFinishRequest } from "./models/login-finish.request";
import { LoginStartRequest } from "./models/login-start.request";
import { RegistrationFinishRequest } from "./models/registration-finish.request";
import { RegistrationStartRequest } from "./models/registration-start.request";
import { OpaqueApiService } from "./opaque-api.service";
import { OpaqueService } from "./opaque.service";

export class DefaultOpaqueService implements OpaqueService {
  constructor(
    private opaqueApiService: OpaqueApiService,
    private sdkService: SdkService,
  ) {}

  async register(
    masterPassword: string,
    userKey: UserKey,
    ksfParameters: Argon2IdParameters,
  ): Promise<OpaqueSessionId> {
    const config = new CipherConfiguration(ksfParameters);
    const cryptoClient = (await firstValueFrom(this.sdkService.client$)).crypto();

    const registrationStart = cryptoClient.opaque_register_start(
      masterPassword,
      config.toSdkConfig(),
    );
    const registrationStartResponse = await this.opaqueApiService.registrationStart(
      new RegistrationStartRequest(
        Utils.fromBufferToB64(registrationStart.registration_request),
        config,
      ),
    );

    const registrationFinish = cryptoClient.opaque_register_finish(
      masterPassword,
      config.toSdkConfig(),
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

    await this.opaqueApiService.registrationFinish(
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
    ksfConfig: Argon2IdParameters,
  ): Promise<Uint8Array> {
    const config = new CipherConfiguration(ksfConfig);
    const cryptoClient = (await firstValueFrom(this.sdkService.client$)).crypto();

    const loginStart = cryptoClient.opaque_login_start(masterPassword, config.toSdkConfig());
    const loginStartResponse = await this.opaqueApiService.loginStart(
      new LoginStartRequest(email, Utils.fromBufferToB64(loginStart.credential_request)),
    );

    const loginFinish = cryptoClient.opaque_login_finish(
      masterPassword,
      config.toSdkConfig(),
      Utils.fromB64ToArray(loginStartResponse.credentialResponse),
      loginStart.state,
    );

    const success = await this.opaqueApiService.loginFinish(
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
