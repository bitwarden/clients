import { UserId } from "../../types/guid";

export interface SsoJitProvisionFinishKeyConnectorParams {
  userId: UserId;
  /** The organization that provisions the user. The service matches it to a stored open invite. */
  orgId: string;
  orgSsoIdentifier: string;
  /** The Key Connector server. The SDK posts the Key Connector key to it. */
  keyConnectorUrl: string;
}
