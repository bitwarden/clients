import {
  ProviderStatusType,
  ProviderType,
  ProviderUserStatusType,
  ProviderUserType,
} from "../../enums";
import { ProfileProviderResponse } from "../response/profile-provider.response";

export class ProviderData {
  id: string;
  name: string;
  status: ProviderUserStatusType;
  type: ProviderUserType;
  enabled: boolean;
  userId: string;
  useEvents: boolean;
  providerStatus: ProviderStatusType;
  providerType: ProviderType;

  constructor(response: ProfileProviderResponse) {
    this.id = response.id;
    this.name = response.name;
    this.status = response.status;
    this.type = response.type;
    this.enabled = response.enabled;
    this.userId = response.userId;
    this.useEvents = response.useEvents;
    this.providerStatus = response.providerStatus;
    this.providerType = response.providerType;
  }
}
