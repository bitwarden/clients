import { Guid } from "@bitwarden/common/types/guid";

export type CredentialCreatePayload = {
  userId: Guid;
  userName: string;
  password: string;
  name: string;
  uri: string;
};
