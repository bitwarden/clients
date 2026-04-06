import { firstValueFrom } from "rxjs";

import { Cipher } from "@bitwarden/common/vault/models/domain/cipher";
import { CipherView } from "@bitwarden/common/vault/models/view/cipher.view";
import {
  RestrictedCipherType,
  RestrictedItemTypesService,
} from "@bitwarden/common/vault/services/restricted-item-types.service";

export class CliRestrictedItemTypesService {
  constructor(private restrictedItemTypesService: RestrictedItemTypesService) {}

  /**
   * Gets all restricted cipher types for the current user.
   *
   * @returns Promise resolving to array of restricted cipher types with allowed organization IDs
   */
  async getRestrictedTypes(): Promise<RestrictedCipherType[]> {
    return firstValueFrom(this.restrictedItemTypesService.restricted$);
  }

  /**
   * Filters out restricted cipher types from an array of ciphers.
   *
   * @param ciphers - Array of ciphers to filter
   * @returns Promise resolving to filtered array with restricted ciphers removed
   */
  async filterRestrictedCiphers(ciphers: CipherView[]): Promise<CipherView[]> {
    const restrictions = await this.getRestrictedTypes();

    return ciphers.filter(
      (cipher) => !this.restrictedItemTypesService.isCipherRestricted(cipher, restrictions),
    );
  }

  /**
   * Checks if a specific cipher type is restricted for the user.
   *
   * @param cipherType - The cipher type to check
   * @returns Promise resolving to true if the cipher type is restricted, false otherwise
   */
  async isCipherRestricted(cipher: Cipher | CipherView): Promise<boolean> {
    return firstValueFrom(this.restrictedItemTypesService.isCipherRestricted$(cipher));
  }
}
