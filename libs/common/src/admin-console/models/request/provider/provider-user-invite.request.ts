// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { ProviderUserType } from "../../../enums";

export class ProviderUserInviteRequest {
  emails: string[] = [];
  type: ProviderUserType;
}
