import { Jsonify } from "type-fest";

import { CIPHERS_DISK, DeriveDefinition, KeyDefinition } from "../../../platform/state";
import { CipherService } from "../../abstractions/cipher.service";
import { CipherData } from "../../models/data/cipher.data";
import { Cipher } from "../../models/domain/cipher";
import { CipherView } from "../../models/view/cipher.view";

export const ENCRYPTED_CIPHERS = KeyDefinition.record<CipherData>(CIPHERS_DISK, "ciphers", {
  deserializer: (obj: Jsonify<CipherData>) => CipherData.fromJSON(obj),
});

export const DECRYPTED_CIPHERS = DeriveDefinition.from<
  Record<string, CipherData>,
  CipherView[],
  { cipherService: CipherService }
>(ENCRYPTED_CIPHERS, {
  deserializer: (obj) => obj.map((c) => CipherView.fromJSON(c)),
  derive: async (from, { cipherService }) => {
    const ciphers = Object.values(from || {}).map((c) => new Cipher(c));
    return await cipherService.decryptCiphers(ciphers);
  },
});
