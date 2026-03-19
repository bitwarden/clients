import { OrgIntegrationTemplate } from "../../integration-builder";
import { OrganizationIntegrationServiceName } from "../../organization-integration-service-type";

export class DatadogTemplate implements OrgIntegrationTemplate {
  bw_serviceName: OrganizationIntegrationServiceName;

  constructor(service: OrganizationIntegrationServiceName) {
    this.bw_serviceName = service;
  }

  private toJSON() {
    return {
      bw_serviceName: this.bw_serviceName,
      ddsource: "bitwarden",
      service: "event-logs",
      event: {
        object: "event",
        type: "#TypeId#",
        typeName: "#Type#",
        memberId: "#UserId#",
        organizationId: "#OrganizationId#",
        providerId: "#ProviderId#",
        itemId: "#CipherId#",
        collectionId: "#CollectionId#",
        groupId: "#GroupId#",
        policyId: "#PolicyId#",
        organizationUserId: "#OrganizationUserId#",
        providerUserId: "#ProviderUserId#",
        providerOrganizationId: "#ProviderOrganizationId#",
        actingUserId: "#ActingUserId#",
        installationId: "#InstallationId#",
        date: "#DateIso8601#",
        deviceType: "#DeviceType#",
        device: "#DeviceTypeId#",
        ipAddress: "#IpAddress#",
        systemUser: "#SystemUser#",
        domainName: "#DomainName#",
        secretId: "#SecretId#",
        projectId: "#ProjectId#",
        serviceAccountId: "#ServiceAccountId#",
      },
      enrichment_details: {
        actingUser: {
          name: "#ActingUserName#",
          email: "#ActingUserEmail#",
          type: "#ActingUserType#",
        },
        member: {
          name: "#UserName#",
          email: "#UserEmail#",
          type: "#UserType#",
        },
        group: {
          name: "#GroupName#",
        },
      },
    };
  }

  toString(): string {
    return JSON.stringify(this.toJSON());
  }
}
