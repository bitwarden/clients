import { Guid } from "@bitwarden/common/types/guid";

export class ServiceAccountView {
  id: Guid;
  organizationId: Guid;
  name: string;
  creationDate: string;
  revisionDate: string;
}
