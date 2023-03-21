import { Guid } from "@bitwarden/common/types/guid";

export type CredentialRetrievePayload = {
  userId: Guid;
  uri: string;
};
