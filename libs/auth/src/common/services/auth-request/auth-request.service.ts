import { ApiService } from "@bitwarden/common/abstractions/api.service";
import { PasswordlessAuthRequest } from "@bitwarden/common/auth/models/request/passwordless-auth.request";
import { AuthRequestResponse } from "@bitwarden/common/auth/models/response/auth-request.response";
import { AppIdService } from "@bitwarden/common/platform/abstractions/app-id.service";
import { CryptoService } from "@bitwarden/common/platform/abstractions/crypto.service";
import { StateService } from "@bitwarden/common/platform/abstractions/state.service";
import { Utils } from "@bitwarden/common/platform/misc/utils";
import { SymmetricCryptoKey } from "@bitwarden/common/platform/models/domain/symmetric-crypto-key";
import { MasterKey, UserKey } from "@bitwarden/common/types/key";

import { AuthRequestServiceAbstraction } from "../../abstractions/auth-request.service.abstraction";

export class AuthRequestService implements AuthRequestServiceAbstraction {
  constructor(
    private appIdService: AppIdService,
    private cryptoService: CryptoService,
    private apiService: ApiService,
    private stateService: StateService,
  ) {}

  async approveOrDenyAuthRequest(
    approve: boolean,
    authRequest: AuthRequestResponse,
  ): Promise<AuthRequestResponse> {
    if (!authRequest.id) {
      throw new Error("Auth request has no id");
    }
    if (!authRequest.publicKey) {
      throw new Error("Auth request has no public key");
    }
    const pubKey = Utils.fromB64ToArray(authRequest.publicKey);

    const masterKey = await this.cryptoService.getMasterKey();
    const masterKeyHash = await this.stateService.getKeyHash();
    let encryptedMasterKeyHash;
    let keyToEncrypt;

    if (masterKey && masterKeyHash) {
      // Only encrypt the master password hash if masterKey exists as
      // we won't have a masterKeyHash without a masterKey
      encryptedMasterKeyHash = await this.cryptoService.rsaEncrypt(
        Utils.fromUtf8ToArray(masterKeyHash),
        pubKey,
      );
      keyToEncrypt = masterKey.encKey;
    } else {
      const userKey = await this.cryptoService.getUserKey();
      keyToEncrypt = userKey.key;
    }

    const encryptedKey = await this.cryptoService.rsaEncrypt(keyToEncrypt, pubKey);

    const response = new PasswordlessAuthRequest(
      encryptedKey.encryptedString,
      encryptedMasterKeyHash?.encryptedString,
      await this.appIdService.getAppId(),
      approve,
    );
    return await this.apiService.putAuthRequest(authRequest.id, response);
  }

  async setUserKeyAfterDecryptingSharedUserKey(
    authReqResponse: AuthRequestResponse,
    authReqPrivateKey: Uint8Array,
  ) {
    const userKey = await this.decryptPubKeyEncryptedUserKey(
      authReqResponse.key,
      authReqPrivateKey,
    );
    await this.cryptoService.setUserKey(userKey);
  }

  async setKeysAfterDecryptingSharedMasterKeyAndHash(
    authReqResponse: AuthRequestResponse,
    authReqPrivateKey: Uint8Array,
  ) {
    const { masterKey, masterKeyHash } = await this.decryptPubKeyEncryptedMasterKeyAndHash(
      authReqResponse.key,
      authReqResponse.masterPasswordHash,
      authReqPrivateKey,
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
    privateKey: Uint8Array,
  ): Promise<UserKey> {
    const decryptedUserKeyBytes = await this.cryptoService.rsaDecrypt(
      pubKeyEncryptedUserKey,
      privateKey,
    );

    return new SymmetricCryptoKey(decryptedUserKeyBytes) as UserKey;
  }

  async decryptPubKeyEncryptedMasterKeyAndHash(
    pubKeyEncryptedMasterKey: string,
    pubKeyEncryptedMasterKeyHash: string,
    privateKey: Uint8Array,
  ): Promise<{ masterKey: MasterKey; masterKeyHash: string }> {
    const decryptedMasterKeyArrayBuffer = await this.cryptoService.rsaDecrypt(
      pubKeyEncryptedMasterKey,
      privateKey,
    );

    const decryptedMasterKeyHashArrayBuffer = await this.cryptoService.rsaDecrypt(
      pubKeyEncryptedMasterKeyHash,
      privateKey,
    );

    const masterKey = new SymmetricCryptoKey(decryptedMasterKeyArrayBuffer) as MasterKey;
    const masterKeyHash = Utils.fromBufferToUtf8(decryptedMasterKeyHashArrayBuffer);

    return {
      masterKey,
      masterKeyHash,
    };
  }
}
