// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import {
  ProviderStatusType,
  ProviderType,
  ProviderUserStatusType,
  ProviderUserType,
} from "../../enums";
import { ProviderData } from "../data/provider.data";

export class Provider {
  id: string;
  name: string;
  status: ProviderUserStatusType;
  type: ProviderUserType;
  enabled: boolean;
  userId: string;
  useEvents: boolean;
  providerStatus: ProviderStatusType;
  providerType: ProviderType;

  constructor(obj?: ProviderData) {
    if (obj == null) {
      return;
    }

    this.id = obj.id;
    this.name = obj.name;
    this.status = obj.status;
    this.type = obj.type;
    this.enabled = obj.enabled;
    this.userId = obj.userId;
    this.useEvents = obj.useEvents;
    this.providerStatus = obj.providerStatus;
    this.providerType = obj.providerType;
  }

  get canAccess() {
    if (this.isProviderAdmin) {
      return true;
    }
    return this.enabled && this.status === ProviderUserStatusType.Confirmed;
  }

  get canCreateOrganizations() {
    return this.enabled && this.isProviderAdmin;
  }

  get canManageUsers() {
    return this.isProviderAdmin;
  }

  get canAccessEventLogs() {
    return this.isProviderAdmin;
  }

  get isProviderAdmin() {
    return this.type === ProviderUserType.ProviderAdmin;
  }
}
