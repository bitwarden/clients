import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { CipherData } from "@bitwarden/common/vault/models/data/cipher.data";
import { Cipher } from "@bitwarden/common/vault/models/domain/cipher";

/**
 * The full cipher while a lease covers it, or `null` while the server still returns the
 * restricted shape. Never written to the local cipher store.
 *
 * The module's last raw-HTTP call: move it onto `pam().leases().leased_cipher(cipherId)` once a
 * published `sdk-internal` carries it.
 */
export async function fetchLeasedCipher(
  apiService: ApiService,
  cipherId: string,
): Promise<Cipher | null> {
  const response = await apiService.getFullCipherDetails(cipherId);
  const cipher = new Cipher(new CipherData(response));
  return cipher.partialData == null ? cipher : null;
}
