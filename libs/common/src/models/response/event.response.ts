import { DeviceType } from "../../enums/deviceType";
import { EventSystemUser } from "../../enums/event-system-user";
import { EventType } from "../../enums/eventType";
import { Guid } from "../../types/guid";

import { BaseResponse } from "./base.response";

export class EventResponse extends BaseResponse {
  type: EventType;
  userId: Guid;
  organizationId: Guid;
  providerId: Guid;
  cipherId: Guid;
  collectionId: Guid;
  groupId: Guid;
  policyId: Guid;
  organizationUserId: Guid;
  providerUserId: Guid;
  providerOrganizationId: Guid;
  actingUserId: Guid;
  date: string;
  deviceType: DeviceType;
  ipAddress: string;
  installationId: Guid;
  systemUser: EventSystemUser;
  domainName: string;
  secretId: Guid;
  serviceAccountId: Guid;

  constructor(response: any) {
    super(response);
    this.type = this.getResponseProperty("Type");
    this.userId = this.getResponseProperty<Guid>("UserId");
    this.organizationId = this.getResponseProperty<Guid>("OrganizationId");
    this.providerId = this.getResponseProperty<Guid>("ProviderId");
    this.cipherId = this.getResponseProperty<Guid>("CipherId");
    this.collectionId = this.getResponseProperty<Guid>("CollectionId");
    this.groupId = this.getResponseProperty<Guid>("GroupId");
    this.policyId = this.getResponseProperty<Guid>("PolicyId");
    this.organizationUserId = this.getResponseProperty<Guid>("OrganizationUserId");
    this.providerUserId = this.getResponseProperty<Guid>("ProviderUserId");
    this.providerOrganizationId = this.getResponseProperty<Guid>("ProviderOrganizationId");
    this.actingUserId = this.getResponseProperty<Guid>("ActingUserId");
    this.date = this.getResponseProperty("Date");
    this.deviceType = this.getResponseProperty("DeviceType");
    this.ipAddress = this.getResponseProperty("IpAddress");
    this.installationId = this.getResponseProperty<Guid>("InstallationId");
    this.systemUser = this.getResponseProperty("SystemUser");
    this.domainName = this.getResponseProperty("DomainName");
    this.secretId = this.getResponseProperty<Guid>("SecretId");
    this.serviceAccountId = this.getResponseProperty<Guid>("ServiceAccountId");
  }
}
