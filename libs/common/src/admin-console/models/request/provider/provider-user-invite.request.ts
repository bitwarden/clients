import { ProviderUserType } from "../../../enums";

export class ProviderUserInviteRequest {
  emails: string[];
  type: ProviderUserType;

  constructor(c: { emails: string[]; type: ProviderUserType }) {
    this.emails = c.emails;
    this.type = c.type;
  }
}
