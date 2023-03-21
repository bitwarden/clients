import { Guid } from "@bitwarden/common/types/guid";

export type CipherResponse = {
  userId: Guid;
  credentialId: Guid;
  userName: string;
  password: string;
  name: string;
};
