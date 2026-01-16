import { OrgIntegrationTemplate } from "../../integration-builder";
import { OrganizationIntegrationServiceName } from "../../organization-integration-service-type";

export class HecTemplate implements OrgIntegrationTemplate {
  index: string;
  bw_serviceName: OrganizationIntegrationServiceName;

  constructor(index: string, service: OrganizationIntegrationServiceName) {
    this.index = index;
    this.bw_serviceName = service;
  }

  private toJSON() {
    const template: Record<string, any> = {
      bw_serviceName: this.bw_serviceName,
      source: "bitwarden",
      service: "event-logs",
      event: {
        object: "event",
        type: "#Type#",
        itemId: "#CipherId#",
        collectionId: "#CollectionId#",
        groupId: "#GroupId#",
        policyId: "#PolicyId#",
        memberId: "#UserId#",
        actingUserId: "#ActingUserId#",
        installationId: "#InstallationId#",
        date: "#DateIso8601#",
        device: "#DeviceType#",
        ipAddress: "#IpAddress#",
        secretId: "#SecretId#",
        projectId: "#ProjectId#",
        serviceAccountId: "#ServiceAccountId#",
        actingUserName: "#ActingUserName#",
        actingUserEmail: "#ActingUserEmail#",
        actingUserType: "#ActingUserType#",
        userName: "#UserName#",
        userEmail: "#UserEmail#",
        userType: "#UserType#",
        groupName: "#GroupName#",
      },
    };

    // Only include index if it's provided
    if (this.index && this.index.trim() !== "") {
      template.index = this.index;
    }

    return template;
  }

  toString(): string {
    return JSON.stringify(this.toJSON());
  }
}
