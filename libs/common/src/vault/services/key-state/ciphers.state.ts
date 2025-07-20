// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { Jsonify } from "type-fest";

import {
  CIPHERS_DISK,
  CIPHERS_DISK_LOCAL,
  CIPHERS_MEMORY,
  UserKeyDefinition,
} from "../../../platform/state";
import { CipherId } from "../../../types/guid";
import { CipherData } from "../../models/data/cipher.data";
import { LocalData } from "../../models/data/local.data";
import { CipherView } from "../../models/view/cipher.view";
import { AddEditCipherInfo } from "../../types/add-edit-cipher-info";

export const ENCRYPTED_CIPHERS = UserKeyDefinition.record<CipherData>(CIPHERS_DISK, "ciphers", {
  deserializer: (obj: Jsonify<CipherData>) => CipherData.fromJSON(obj),
  clearOn: ["logout"],
});

export const DECRYPTED_CIPHERS = UserKeyDefinition.record<CipherView>(
  CIPHERS_MEMORY,
  "decryptedCiphers",
  {
    deserializer: (cipher: Jsonify<CipherView>) => CipherView.fromJSON(cipher),
    clearOn: ["logout", "lock"],
  },
);

export const FAILED_DECRYPTED_CIPHERS = UserKeyDefinition.array<CipherView>(
  CIPHERS_MEMORY,
  "failedDecryptedCiphers",
  {
    deserializer: (cipher: Jsonify<CipherView>) => CipherView.fromJSON(cipher),
    clearOn: ["logout", "lock"],
  },
);

export const LOCAL_DATA_KEY = new UserKeyDefinition<Record<CipherId, LocalData>>(
  CIPHERS_DISK_LOCAL,
  "localData",
  {
    deserializer: (localData) => localData,
    clearOn: ["logout"],
  },
);

export const ADD_EDIT_CIPHER_INFO_KEY = new UserKeyDefinition<AddEditCipherInfo>(
  CIPHERS_MEMORY,
  "addEditCipherInfo",
  {
    deserializer: (addEditCipherInfo: AddEditCipherInfo) => {
      if (addEditCipherInfo == null) {
        return null;
      }

      const cipher =
        addEditCipherInfo?.cipher.toJSON != null
          ? addEditCipherInfo.cipher
          : CipherView.fromJSON(addEditCipherInfo?.cipher as Jsonify<CipherView>);

      return { cipher, collectionIds: addEditCipherInfo.collectionIds };
    },
    clearOn: ["logout", "lock"],
  },
);
