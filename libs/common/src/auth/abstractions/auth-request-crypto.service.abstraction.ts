import { UserKey, MasterKey } from "../../platform/models/domain/symmetric-crypto-key";
import { AuthRequestResponse } from "../models/response/auth-request.response";

export abstract class AuthRequestCryptoServiceAbstraction {
  setUserKeyAfterDecryptingSharedUserKey: (
    authReqResponse: AuthRequestResponse,
    authReqPrivateKey: ArrayBuffer
  ) => Promise<void>;
  setKeysAfterDecryptingSharedMasterKeyAndHash: (
    authReqResponse: AuthRequestResponse,
    authReqPrivateKey: ArrayBuffer
  ) => Promise<void>;

  decryptPubKeyEncryptedUserKey: (
    pubKeyEncryptedUserKey: string,
    privateKey: ArrayBuffer
  ) => Promise<UserKey>;

  decryptPubKeyEncryptedMasterKeyAndHash: (
    pubKeyEncryptedMasterKey: string,
    pubKeyEncryptedMasterKeyHash: string,
    privateKey: ArrayBuffer
  ) => Promise<{ masterKey: MasterKey; masterKeyHash: string }>;
}
