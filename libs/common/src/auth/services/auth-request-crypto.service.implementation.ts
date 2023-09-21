import { CryptoService } from "../../platform/abstractions/crypto.service";
import { Utils } from "../../platform/misc/utils";
import {
  UserKey,
  SymmetricCryptoKey,
  MasterKey,
} from "../../platform/models/domain/symmetric-crypto-key";
import { AuthRequestCryptoServiceAbstraction } from "../abstractions/auth-request-crypto.service.abstraction";
import { AuthRequestResponse } from "../models/response/auth-request.response";

export class AuthRequestCryptoServiceImplementation implements AuthRequestCryptoServiceAbstraction {
  constructor(private cryptoService: CryptoService) {}

  async setUserKeyAfterDecryptingSharedUserKey(
    authReqResponse: AuthRequestResponse,
    authReqPrivateKey: Uint8Array
  ) {
    const userKey = await this.decryptPubKeyEncryptedUserKey(
      authReqResponse.key,
      authReqPrivateKey
    );
    await this.cryptoService.setUserKey(userKey);
  }

  async setKeysAfterDecryptingSharedMasterKeyAndHash(
    authReqResponse: AuthRequestResponse,
    authReqPrivateKey: Uint8Array
  ) {
    const { masterKey, masterKeyHash } = await this.decryptPubKeyEncryptedMasterKeyAndHash(
      authReqResponse.key,
      authReqResponse.masterPasswordHash,
      authReqPrivateKey
    );

    // Decrypt and set user key in state
    const userKey = await this.cryptoService.decryptUserKeyWithMasterKey(masterKey);

    // Set masterKey + masterKeyHash in state after decryption (in case decryption fails)
    await this.cryptoService.setMasterKey(masterKey);
    await this.cryptoService.setMasterKeyHash(masterKeyHash);

    await this.cryptoService.setUserKey(userKey);
  }

  // Decryption helpers
  async decryptPubKeyEncryptedUserKey(
    pubKeyEncryptedUserKey: string,
    privateKey: Uint8Array
  ): Promise<UserKey> {
    const decryptedUserKeyBytes = await this.cryptoService.rsaDecrypt(
      pubKeyEncryptedUserKey,
      privateKey
    );

    return new SymmetricCryptoKey(decryptedUserKeyBytes) as UserKey;
  }

  async decryptPubKeyEncryptedMasterKeyAndHash(
    pubKeyEncryptedMasterKey: string,
    pubKeyEncryptedMasterKeyHash: string,
    privateKey: Uint8Array
  ): Promise<{ masterKey: MasterKey; masterKeyHash: string }> {
    const decryptedMasterKeyArrayBuffer = await this.cryptoService.rsaDecrypt(
      pubKeyEncryptedMasterKey,
      privateKey
    );

    const decryptedMasterKeyHashArrayBuffer = await this.cryptoService.rsaDecrypt(
      pubKeyEncryptedMasterKeyHash,
      privateKey
    );

    const masterKey = new SymmetricCryptoKey(decryptedMasterKeyArrayBuffer) as MasterKey;
    const masterKeyHash = Utils.fromBufferToUtf8(decryptedMasterKeyHashArrayBuffer);

    return {
      masterKey,
      masterKeyHash,
    };
  }
}
