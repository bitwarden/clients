import { ProviderUserStatusType } from "../../enums/providerUserStatusType";
import { ProviderUserType } from "../../enums/providerUserType";
import { Guid } from "../../types/guid";
import { ProfileProviderResponse } from "../response/profile-provider.response";

export class ProviderData {
  id: Guid;
  name: string;
  status: ProviderUserStatusType;
  type: ProviderUserType;
  enabled: boolean;
  userId: Guid;
  useEvents: boolean;

  constructor(response: ProfileProviderResponse) {
    this.id = response.id;
    this.name = response.name;
    this.status = response.status;
    this.type = response.type;
    this.enabled = response.enabled;
    this.userId = response.userId;
    this.useEvents = response.useEvents;
  }
}
