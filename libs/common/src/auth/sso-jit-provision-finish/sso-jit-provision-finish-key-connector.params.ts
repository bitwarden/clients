import { UserId } from "../../types/guid";

export interface SsoJitProvisionFinishKeyConnectorParams {
  userId: UserId;
  orgSsoIdentifier: string;
  /** The Key Connector server. The SDK posts the Key Connector key to it. */
  keyConnectorUrl: string;
}
