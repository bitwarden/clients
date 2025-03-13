import { firstValueFrom } from "rxjs";

import { RotateableKeySet } from "@bitwarden/auth/common";
import { SdkService } from "@bitwarden/common/platform/abstractions/sdk/sdk.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { EncString } from "@bitwarden/common/platform/models/domain/enc-string";

import { UserKey } from "../../types/key";

import { CipherConfiguration, KsfConfig } from "./models/cipher-configuration";
import { RegistrationFinishRequest } from "./models/registration-finish.request";
import { RegistrationStartRequest } from "./models/registration-start.request";
import { OpaqueApiService } from "./opaque-api.service";
import { OpaqueService } from "./opaque.service";

export class DefaultOpaqueService implements OpaqueService {
  constructor(
    private opaqueApiService: OpaqueApiService,
    private sdkService: SdkService,
  ) {}

  async register(masterPassword: string, userKey: UserKey, ksfConfig: KsfConfig): Promise<void> {
    const config = new CipherConfiguration(ksfConfig);
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
  }

  async login(masterPassword: string, ksfConfig: KsfConfig): Promise<Uint8Array> {
    throw new Error("Method not implemented.");

    // TODO: figure out if we are going to implement this as one process with 2 calls to crypto
    // and API
    // cryptoClient.opaque_login_start(masterPassword, ksfConfig.toSdkConfig());
    // cryptoClient.opaque_login_finish(...);

    // TODO: should this logic belong in the login strategy?
  }
}
