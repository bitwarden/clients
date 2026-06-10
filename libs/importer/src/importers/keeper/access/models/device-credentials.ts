import { DeviceToken } from "./token-types";

export interface DeviceCredentials {
  deviceToken: DeviceToken;
  /** P-256 device private key, PKCS#8 DER encoded. */
  devicePrivateKey: Uint8Array;
}
