import { CipherId } from "../../types/guid";
import { LocalData } from "../models/data/local.data";
import { CipherView } from "../models/view/cipher.view";

/**
 * Re-attaches client-only {@link LocalData} to decrypted {@link CipherView}s and returns them
 * (`localData` is a client-side-only field. The SDK decryption path does not populate it on the
 * views it returns).
 *
 * @param ciphers - The decrypted cipher views to hydrate. Mutated in place.
 * @param localData - The per-cipher local data map, e.g. from `CipherService.localData$`.
 * @returns The hydrated `ciphers` array
 */
export function hydrateCiphersWithLocalData(
  ciphers: CipherView[],
  localData: Record<CipherId, LocalData> | null | undefined,
): CipherView[] {
  if (localData) {
    for (const cipher of ciphers) {
      if (cipher?.id == null) {
        continue;
      }

      const data = localData[cipher.id as CipherId];
      if (data) {
        cipher.localData = data;
      }
    }
  }

  return ciphers;
}
