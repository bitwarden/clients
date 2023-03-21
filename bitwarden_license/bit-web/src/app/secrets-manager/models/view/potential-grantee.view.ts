import { Guid } from "@bitwarden/common/types/guid";

export class PotentialGranteeView {
  id: Guid;
  name: string;
  type: string;
  email: string;
}
