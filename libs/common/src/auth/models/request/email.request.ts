// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { EmailTokenRequest } from "./email-token.request";

export class EmailRequest extends EmailTokenRequest {
  newMasterPasswordHash: string;
  token: string;
  key: string;
}
