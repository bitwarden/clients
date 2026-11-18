import { UserId } from "../../types/guid";

export interface SsoJitProvisionFinishKeyConnectorParams {
  userId: UserId;
  orgSsoIdentifier: string;
  /** The Key Connector server. The SDK posts the Key Connector key to it. */
  keyConnectorUrl: string;
  /**
   * Whether the server moves the organization membership from Invited to Accepted. `undefined`
   * means accept.
   */
  acceptOrganizationInvite?: boolean;
}
