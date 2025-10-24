import { firstValueFrom, switchMap } from "rxjs";

import { CipherService } from "@bitwarden/common/vault/abstractions/cipher.service";
import {
  CipherLoginDetails,
  CipherRiskOptions,
  PasswordReuseMap,
  CipherId,
  CipherRiskResult,
} from "@bitwarden/sdk-internal";

import { SdkService, asUuid } from "../../platform/abstractions/sdk/sdk.service";
import { UserId } from "../../types/guid";
import { CipherRiskService as CipherRiskServiceAbstraction } from "../abstractions/cipher-risk.service";
import { CipherType } from "../enums/cipher-type";
import { CipherView } from "../models/view/cipher.view";

export class DefaultCipherRiskService implements CipherRiskServiceAbstraction {
  constructor(
    private sdkService: SdkService,
    private cipherService: CipherService,
  ) {}

  async computeRiskForCiphers(
    ciphers: CipherView[],
    userId: UserId,
    options?: CipherRiskOptions,
  ): Promise<CipherRiskResult[]> {
    const loginDetails = this.mapToLoginDetails(ciphers);

    if (loginDetails.length === 0) {
      return [];
    }

    return await firstValueFrom(
      this.sdkService.userClient$(userId).pipe(
        switchMap(async (sdk) => {
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

  async computeCipherRiskForUser(
    cipherId: CipherId,
    userId: UserId,
    checkExposed: boolean = true,
  ): Promise<CipherRiskResult> {
    // Get all ciphers for the user
    const allCiphers = await firstValueFrom(this.cipherService.cipherViews$(userId));

    // Find the specific cipher
    const targetCipher = allCiphers?.find((c) => asUuid<CipherId>(c.id) === cipherId);
    if (!targetCipher) {
      throw new Error(`Cipher with id ${cipherId} not found`);
    }

    // Build fresh password reuse map from all ciphers
    const passwordMap = await this.buildPasswordReuseMap(allCiphers, userId);

    // Call existing computeRiskForCiphers with single cipher and map
    const results = await this.computeRiskForCiphers([targetCipher], userId, {
      passwordMap,
      checkExposed,
    });

    return results[0];
  }

  async buildPasswordReuseMap(ciphers: CipherView[], userId: UserId): Promise<PasswordReuseMap> {
    const loginDetails = this.mapToLoginDetails(ciphers);

    if (loginDetails.length === 0) {
      return {};
    }

    return await firstValueFrom(
      this.sdkService.userClient$(userId).pipe(
        switchMap(async (sdk) => {
          using ref = sdk.take();
          const cipherRiskClient = ref.value.vault().cipher_risk();
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
