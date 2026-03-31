import { BaseResponse } from "../../../models/response/base.response";

export class PasskeyDirectoryEntryResponse extends BaseResponse {
  domainName: string;
  instructions: string | undefined;
  supportsPasskeyLogin: boolean;
  supportsPasskeyMfa: boolean;

  constructor(response: any) {
    super(response);
    this.domainName = this.getResponseProperty("DomainName");
    this.instructions = this.getResponseProperty("Instructions");
    this.supportsPasskeyLogin = this.getResponseProperty("Passwordless") ?? false;
    this.supportsPasskeyMfa = this.getResponseProperty("Mfa") ?? false;
  }
}
