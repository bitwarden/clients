import { Guid } from "@bitwarden/common/types/guid";

export type LegacyMessage = {
  command: string;

  userId?: Guid;
  timestamp?: number;

  publicKey?: string;
};
