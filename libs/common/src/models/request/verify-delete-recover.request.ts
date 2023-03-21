import { Guid } from "../../types/guid";

export class VerifyDeleteRecoverRequest {
  userId: Guid;
  token: string;

  constructor(userId: Guid, token: string) {
    this.userId = userId;
    this.token = token;
  }
}
