import { Guid } from "../../types/guid";

import { BaseResponse } from "./base.response";

export class UserKeyResponse extends BaseResponse {
  userId: Guid;
  publicKey: string;

  constructor(response: any) {
    super(response);
    this.userId = this.getResponseProperty<Guid>("UserId");
    this.publicKey = this.getResponseProperty("PublicKey");
  }
}
