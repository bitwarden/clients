import { firstValueFrom, map } from "rxjs";

import type {
  CipherLoginDetails,
  CipherRisk,
  CipherRiskOptions,
  PasswordReuseMap,
  CipherId,
} from "@bitwarden/sdk-internal";

import { SdkService, asUuid } from "../../platform/abstractions/sdk/sdk.service";
import { UserId } from "../../types/guid";
import { CipherRiskService as CipherRiskServiceAbstraction } from "../abstractions/cipher-risk.service";
import { CipherType } from "../enums/cipher-type";
import { CipherView } from "../models/view/cipher.view";

export class DefaultCipherRiskService implements CipherRiskServiceAbstraction {
  constructor(private sdkService: SdkService) {}

  async computeRisk(
    ciphers: CipherView[],
    userId: UserId,
    options?: CipherRiskOptions,
  ): Promise<CipherRisk[]> {
    const loginDetails = this.mapToLoginDetails(ciphers);

    if (loginDetails.length === 0) {
      return [];
    }

    return await firstValueFrom(
      this.sdkService.userClient$(userId).pipe(
        map(async (sdk) => {
          using ref = sdk.take();
          const cipherRiskClient = ref.value.vault().cipher_risk();
          return await cipherRiskClient.compute_risk(
            loginDetails,
            options ?? { checkExposed: false },
          );
        }),
      ),
    );
  }

  async buildPasswordReuseMap(ciphers: CipherView[]): Promise<PasswordReuseMap> {
    const loginDetails = this.mapToLoginDetails(ciphers);

    if (loginDetails.length === 0) {
      return {};
    }

    return await firstValueFrom(
      this.sdkService.client$.pipe(
        map((client) => {
          const cipherRiskClient = client.vault().cipher_risk();
          return cipherRiskClient.password_reuse_map(loginDetails);
        }),
      ),
    );
  }

  /**
   * Maps CipherView array to CipherLoginDetails array for SDK consumption.
   * Only includes Login ciphers with non-empty passwords.
   */
  private mapToLoginDetails(ciphers: CipherView[]): CipherLoginDetails[] {
    return ciphers
      .filter((cipher) => {
        return (
          cipher.type === CipherType.Login &&
          cipher.login?.password != null &&
          cipher.login.password !== ""
        );
      })
      .map(
        (cipher) =>
          ({
            id: asUuid<CipherId>(cipher.id),
            password: cipher.login.password!,
            username: cipher.login.username,
          }) satisfies CipherLoginDetails,
      );
  }
}
