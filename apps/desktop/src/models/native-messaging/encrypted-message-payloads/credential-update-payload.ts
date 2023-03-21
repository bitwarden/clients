import { Guid } from "@bitwarden/common/types/guid";

export type CredentialUpdatePayload = {
  userId: Guid;
  userName: string;
  password: string;
  name: string;
  uri: string;
  credentialId: Guid;
};
