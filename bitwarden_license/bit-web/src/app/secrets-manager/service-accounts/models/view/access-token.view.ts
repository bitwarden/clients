import { Guid } from "@bitwarden/common/types/guid";

export class AccessTokenView {
  id: Guid;
  name: string;
  scopes: string[];
  expireAt?: Date;
  creationDate: Date;
  revisionDate: Date;
}
