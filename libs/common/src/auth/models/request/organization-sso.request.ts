// FIXME: Update this file to be type safe and remove this and next line
// @ts-strict-ignore
import { SsoConfigApi } from "../api/sso-config.api";

export class OrganizationSsoRequest {
  enabled = false;
  identifier: string;
  data: SsoConfigApi;
}
