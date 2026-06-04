import { DeviceToken } from "./token-types";

export interface DeviceCredentials {
  deviceToken: DeviceToken;
  devicePrivateKey: CryptoKey;
}
