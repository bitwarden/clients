import { ProviderUserType } from "../../../enums";

export class ProviderUserUpdateRequest {
  type: ProviderUserType;

  constructor(c: { type: ProviderUserType }) {
    this.type = c.type;
  }
}
