import { AccountKeysRequest } from "./account-keys.request";
import { UnlockDataRequest } from "./unlock-data.request";
import { UserDataRequest as AccountDataRequest } from "./userdata.request";

export class RotateUserAccountKeysRequest {
  constructor(
    accountUnlockData: UnlockDataRequest,
    accountKeys: AccountKeysRequest,
    accountData: AccountDataRequest,
    oldMasterKeyAuthenticationHash: string,
  ) {
    this.accountUnlockData = accountUnlockData;
    this.accountKeys = accountKeys;
    this.accountData = accountData;
    this.oldMasterKeyAuthenticationHash = oldMasterKeyAuthenticationHash;
  }

  // Authentication for the request
  oldMasterKeyAuthenticationHash: string;

  // All methods to get to the userkey
  accountUnlockData: UnlockDataRequest;

  // Other keys encrypted by the userkey
  accountKeys: AccountKeysRequest;

  // User vault data encrypted by the userkey
  accountData: AccountDataRequest;
}
