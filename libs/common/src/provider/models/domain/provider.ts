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

  constructor(c: ProviderData) {
    this.id = c.id;
    this.name = c.name;
    this.status = c.status;
    this.type = c.type;
    this.enabled = c.enabled;
    this.userId = c.userId;
    this.useEvents = c.useEvents;
    this.providerStatus = c.providerStatus;
    this.providerType = c.providerType;
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
