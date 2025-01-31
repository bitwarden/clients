import { BaseResponse } from "@bitwarden/common/models/response/base.response";

export class AddableOrganizationResponse extends BaseResponse {
  id: string;
  plan: string;
  name: string;
  seats: number;
  disabled: boolean;

  constructor(response: any) {
    super(response);
    this.id = this.getResponseProperty("id");
    this.plan = this.getResponseProperty("plan");
    this.name = this.getResponseProperty("name");
    this.seats = this.getResponseProperty("seats");
    this.disabled = this.getResponseProperty("disabled");
  }
}
