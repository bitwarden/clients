// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { EncArrayBuffer } from "@bitwarden/common/key-management/crypto/models/domain/enc-array-buffer";
import { EncString } from "@bitwarden/common/key-management/crypto/models/domain/enc-string";
import { SymmetricCryptoKey } from "@bitwarden/common/key-management/crypto/models/domain/symmetric-crypto-key";

import { Cipher } from "../../models/domain/cipher";
import { CipherResponse } from "../../models/response/cipher.response";

export abstract class CipherFileUploadService {
  upload: (
    cipher: Cipher,
    encFileName: EncString,
    encData: EncArrayBuffer,
    admin: boolean,
    dataEncKey: [SymmetricCryptoKey, EncString],
  ) => Promise<CipherResponse>;
}
